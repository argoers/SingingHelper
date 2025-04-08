<template>
  <div class="card">
    <h2 class="section-title">Laulmise tulemus</h2>

    <div class="card" v-if="recordedNotes && musicXmlNotesMappedToBeats">
      <button :disabled="isRecording" @click="$emit('toggle-replay')">
        {{ showReplay ? 'Peida' : 'Näita' }}
      </button>
      <button :disabled="isRecording" v-if="!isReplaying" @click="$emit('start-replay')">
        Käivita
      </button>
      <button :disabled="isRecording" v-if="isReplaying" @click="$emit('stop-replay')">
        Peata
      </button>
    </div>
    <div v-show="showReplay">
      <div class="chart-container">
        <canvas ref="canvas"></canvas>
      </div>
      <div>
        <input
          type="range"
          class="note-highlight"
          min="0"
          :max="duration"
          step="0.1"
          v-model.number="replayTime"
        />
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { getWhichBeatMeasureEndsWith, getCurrentTempo, getYPosition } from '../utils/animationUtils'

export default {
  props: {
    musicXmlNoteInfo: Object,
    musicXmlNotesMappedToBeats: Object,
    recordedNotes: Object,
    isReplaying: Boolean,
    isRecording: Boolean,
    startMeasure: [Number, String],
    endMeasure: [Number, String],
    tempoInfo: Object,
    durationInSeconds: Number,
    speed: [Number, String],
    timeSignatureInfo: Object,
    startTime: Number,
    showReplay: Boolean,
  },
  emits: ['stop-replay', 'start-replay', 'toggle-replay'],
  setup(props, { emit }) {
    const canvas = ref(null)
    let ctx = null
    let notes = []
    let animationFrameId
    const pxPerBeat = 200
    const oneToneHeight = 30

    const firstNotePositionX = 120
    let minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

    const replayTime = ref(0)
    const duration = ref(null)
    let lastFrameTime = performance.now()
    let startBeat = 0
    let startMeasureOnMount
    let endMeasureOnMount
    let measureBeats

    onMounted(() => {
      nextTick(() => {
        startMeasureOnMount = props.startMeasure
        endMeasureOnMount = props.endMeasure
        setUpNotes()
        window.addEventListener('resize', setUpNotes)
      })
    })

    watch(replayTime, () => {
      if (!props.isReplaying) {
        drawStaticNotes()
      }
    })

    watch(
      () => props.recordedNotes,
      () => {
        nextTick(() => {
          startMeasureOnMount = props.startMeasure
          endMeasureOnMount = props.endMeasure
          setUpNotes()
          replayTime.value = 0
        })
      },
    )

    watch(
      () => props.isReplaying,
      (isReplaying) => {
        if (isReplaying) {
          lastFrameTime = performance.now()
          requestAnimationFrame(animate)
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
    )

    const setUpNotes = () => {
      if (!props.musicXmlNoteInfo.length || !props.recordedNotes.length || !canvas.value.getContext)
        return

      minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

      startBeat = getWhichBeatMeasureEndsWith(startMeasureOnMount - 1, props.timeSignatureInfo)
      const endBeat = getWhichBeatMeasureEndsWith(endMeasureOnMount, props.timeSignatureInfo)

      measureBeats = []
      for (let m = Number(props.startMeasure); m <= Number(props.endMeasure); m++) {
        const beat = getWhichBeatMeasureEndsWith(m, props.timeSignatureInfo)
        measureBeats.push(beat)
      }

      ctx = canvas.value.getContext('2d')
      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = (oneToneHeight / 2) * (maxNotePitch - minNotePitch + 5)

      const splitLength = props.durationInSeconds / props.musicXmlNotesMappedToBeats.length

      notes = props.musicXmlNoteInfo.map((note) => {
        const timeIndexes = props.musicXmlNotesMappedToBeats
          .map((_, i) => i)
          .filter((i) => {
            const time = i * splitLength + props.startTime
            return time >= note.start / props.speed && time <= note.end / props.speed
          })
        return {
          pitch: note.pitch,
          x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
          y: getYPosition(note.pitch, minNotePitch, canvas.value.height, oneToneHeight),
          width: note.duration * pxPerBeat,
          name: note.name,
          startBeat: note.offset,
          startTime: note.start,
          duration: note.duration,
          timeIndexes: timeIndexes,
        }
      })

      notes = notes.filter((e) => e.timeIndexes.length > 0 && e.x + e.width > firstNotePositionX)
      duration.value = endBeat - startBeat

      drawStaticNotes()
    }

    const animate = (timestamp) => {
      if (!props.isReplaying) return

      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      const currentTempo = getCurrentTempo(
        replayTime.value,
        props.tempoInfo,
        props.speed,
        props.startMeasure,
      )
      const beatsPerSecond = currentTempo / 60
      const beatsThisFrame = deltaTimeSec * beatsPerSecond

      replayTime.value += beatsThisFrame

      const lastNote = notes[notes.length - 1]

      if (lastNote && replayTime.value >= lastNote.startBeat + lastNote.duration - startBeat) {
        emit('stop-replay')
        cancelAnimationFrame(animationFrameId)
        replayTime.value = 0
        return
      }
      drawStaticNotes()
      animationFrameId = requestAnimationFrame(animate)
    }

    const drawStaticNotes = () => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      drawPlayheads()
      notes.forEach((note) => {
        drawNote(note)
      })
    }

    const drawNote = (note) => {
      const noteScreenX = note.x - replayTime.value * pxPerBeat
      const isActive =
        noteScreenX <= firstNotePositionX && noteScreenX + note.width > firstNotePositionX
      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent'
      ctx.shadowBlur = isActive ? 10 : 0

      note.timeIndexes.forEach((frameIdx, i) => {
        const pitchAtFrame = props.recordedNotes[frameIdx]

        ctx.fillStyle =
          pitchAtFrame <= note.pitch + 0.05 && pitchAtFrame >= note.pitch - 0.05 ? 'green' : 'red'

        const barWidth = note.width / note.timeIndexes.length

        ctx.fillRect(noteScreenX + barWidth * i, note.y, barWidth, oneToneHeight)
      })

      ctx.fillStyle = 'black'
      ctx.font = '25px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, noteScreenX + note.width / 2, note.y - oneToneHeight / 2)
    }

    const drawPlayheads = () => {
      drawPlayhead(firstNotePositionX, true)

      measureBeats.forEach((beat) => {
        const x = firstNotePositionX + (beat - startBeat - replayTime.value) * pxPerBeat
        if (x > 0 && x < canvas.value.width && x != firstNotePositionX) {
          drawPlayhead(x, false)
        }
      })
    }

    const drawPlayhead = (x, isFirst = false) => {
      ctx.strokeStyle = isFirst ? 'red' : 'grey'
      ctx.lineWidth = isFirst ? 5 : 5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.value.height)
      ctx.stroke()
    }

    return { canvas, replayTime, duration }
  },
}
</script>

<style scoped></style>
