<template>
  <div class="card">
    <h2 class="section-title">Laulmise tulemus</h2>

    <div class="card" v-if="recordedNotes && musicXmlNotesMappedToBeats">
      <button @click="$emit('toggle-replay')">
        {{ showReplay ? 'Peida' : 'Näita' }}
      </button>
      <button v-if="!isRecording" @click="$emit('start-replay')">Käivita</button>
      <button v-if="isRecording" @click="$emit('stop-replay')">Peata</button>
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
          step="0.01"
          v-model.number="replayTime"
        />
      </div>
    </div>
  </div>
</template>
<script lang="js">
import { ref, onMounted, watch, watchEffect } from 'vue'
import { getWhichBeatMeasureEndsWith, getCurrentTempo, getYPosition } from '../utils/animationUtils'

export default {
  props: {
    musicXmlNoteInfo: Object,
    musicXmlNotesMappedToBeats: Object,
    recordedNotes: Object,
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
    let pxPerBeat = 200

    let firstNotePositionX
    let minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

    const replayTime = ref(0)
    const duration = ref(null)
    let lastFrameTime = performance.now()
    let startBeat = 0
    let startMeasureOnMount
    let endMeasureOnMount

    onMounted(() => {
      startMeasureOnMount = props.startMeasure
      endMeasureOnMount = props.endMeasure
      setUpNotes()
    })

    watchEffect(() => {
      if (!canvas.value) return
      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      console.log('watchEffect')
      setUpNotes()
    })

    watch(replayTime, () => {
      if (!props.isRecording) {
        drawStaticNotes()
      }
    })

    watch(
      () => props.musicXmlNotesMappedToBeats,
      () => {
        replayTime.value = 0
        startMeasureOnMount = props.startMeasure
        endMeasureOnMount = props.endMeasure
        setUpNotes()
      },
    )

    watch(
      () => props.isRecording,
      (isRecording) => {
        if (isRecording) {
          lastFrameTime = performance.now()
          requestAnimationFrame(animate)
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
    )

    const setUpNotes = () => {
      if (!props.musicXmlNoteInfo.length) return

      minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

      startBeat = getWhichBeatMeasureEndsWith(startMeasureOnMount - 1, props.timeSignatureInfo)
      const endBeat = getWhichBeatMeasureEndsWith(endMeasureOnMount, props.timeSignatureInfo)

      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      const splitLength = props.durationInSeconds / props.musicXmlNotesMappedToBeats.length

      ctx = canvas.value.getContext('2d')

      notes = props.musicXmlNoteInfo.map((note, i) => {
        const timeIndexes = props.musicXmlNotesMappedToBeats
          .map((_, i) => i)
          .filter((i) => {
            const time = i * splitLength + props.startTime
            return time >= note.start / props.speed && time <= note.end / props.speed
          })
        return {
          pitch: note.pitch,
          x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
          y: getYPosition(note.pitch, minNotePitch, canvas.value.height),
          width: note.duration * pxPerBeat,
          name: note.name,
          startBeat: note.offset,
          startTime: note.start,
          duration: note.duration,
          timeIndexes: timeIndexes,
        }
      })
      console.log(notes)
      notes = notes.filter((e) => e.timeIndexes.length > 0 && e.x + e.width > firstNotePositionX)
      duration.value = endBeat - startBeat

      drawStaticNotes()
    }

    const animate = (timestamp) => {
      if (!props.isRecording) return

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
      if (lastNote && replayTime.value >= lastNote.startBeat + lastNote.duration) {
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
      for (let i = 0; i * 10 < canvas.value.width; i++) {
        drawPlayhead(i)
      }
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

        ctx.fillStyle = pitchAtFrame === note.pitch ? 'green' : 'red'

        const barWidth = note.width / note.timeIndexes.length
        ctx.fillRect(noteScreenX + barWidth * i, note.y, barWidth, 20)
      })

      ctx.fillStyle = 'black'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, noteScreenX + note.width / 2, note.y - 10)
    }

    const drawPlayhead = (i = 0) => {
      ctx.strokeStyle = i == 0 ? 'red' : 'grey'
      ctx.lineWidth = i == 0 ? 5 : 0.5
      ctx.beginPath()
      ctx.moveTo(i * pxPerBeat + firstNotePositionX, 0)
      ctx.lineTo(i * pxPerBeat + firstNotePositionX, canvas.value.height)
      ctx.stroke()
    }

    return { canvas, replayTime, duration }
  },
}
</script>

<style scoped></style>
