<template>
  <div>
    <div class="replay-controls" v-if="recordedNotes && midiNotes">
      <button @click="$emit('toggle-replay')">
        {{ showReplay ? 'Hide replay window' : 'Show replay window' }}
      </button>
      <button v-if="!isRecording" @click="$emit('start-replay')">Start replay</button>
      <button v-if="isRecording" @click="$emit('stop-replay')">Stop replay</button>
    </div>
    <div v-show="showReplay">
      <div class="visualizer-container">
        <canvas ref="canvas"></canvas>
      </div>
      <div class="progress-container">
        <input
          type="range"
          class="progress-bar"
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
import { midiToNote } from './ChartDisplay.vue'
import { useWindowSize } from '@vueuse/core'

export default {
  props: {
    midiNotesWithTimes: Object,
    midiNotes: Object,
    recordedNotes: Object,
    isRecording: Boolean,
    tempo: [Number, String],
    startBar: [Number, String],
    endBar: [Number, String],
    tempos: Object,
    durationInSeconds: Number,
    tempoMultiplier: [Number, String],
    timeSignatures: Object,
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
    let pxPerSecond = pxPerBeat / (60 / props.tempos[0].bpm)

    let firstNotePositionX
    let minNotePitch = Math.min(...props.midiNotesWithTimes.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.midiNotesWithTimes.map((e) => e.pitch))

    const replayTime = ref(0)
    const duration = ref(null)
    let lastFrameTime = performance.now()
    let startBeat = 0
    let startBarOnMount
    let endBarOnMount

    onMounted(() => {
      startBarOnMount = props.startBar
      endBarOnMount = props.endBar
      setUpNotes()
    })

    watchEffect(() => {
      if (!canvas.value) return
      canvas.value.width = 0.7 * useWindowSize().width.value
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
      () => props.midiNotes,
      () => {
        replayTime.value = 0
        startBarOnMount = props.startBar
        endBarOnMount = props.endBar
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

    const barToBeat = (barNumber, timeSignatures) => {
      let beats = 0
      let lastBeatOffset = 0
      let lastNumerator = 4
      let lastBarNumber = 0

      for (const ts of timeSignatures) {
        const tsBeatOffset = ts.offset
        const tsNumerator = ts.numerator / (ts.denominator / 4)

        const barsBeforeTS = (tsBeatOffset - lastBeatOffset) / lastNumerator
        const currentBarNumber = lastBarNumber + barsBeforeTS

        if (barNumber < currentBarNumber) break

        beats += (currentBarNumber - lastBarNumber) * lastNumerator
        lastBeatOffset = tsBeatOffset
        lastBarNumber = currentBarNumber
        lastNumerator = tsNumerator
      }

      beats += (barNumber - lastBarNumber) * lastNumerator
      return beats
    }

    const setUpNotes = () => {
      if (!props.midiNotesWithTimes.length) return

      minNotePitch = Math.min(...props.midiNotesWithTimes.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.midiNotesWithTimes.map((e) => e.pitch))

      startBeat = barToBeat(startBarOnMount - 1, props.timeSignatures)
      const endBeat = barToBeat(endBarOnMount, props.timeSignatures)

      canvas.value.width = 0.7 * useWindowSize().width.value
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      const splitLength = props.durationInSeconds / props.midiNotes.length

      ctx = canvas.value.getContext('2d')

      notes = props.midiNotesWithTimes.map((note, i) => {
        const timeIndexes = props.midiNotes
          .map((_, i) => i)
          .filter((i) => {
            const time = i * splitLength + props.startTime
            return (
              time >= note.start / (props.tempoMultiplier / 100) &&
              time <= note.end / (props.tempoMultiplier / 100)
            )
          })
        return {
          pitch: note.pitch,
          x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
          y: getYPosition(note.pitch),
          width: note.duration * pxPerBeat,
          name: midiToNote(note.pitch),
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

    const getCurrentTempo = (beat) => {
      const absoluteBeat = beat + startBeat
      let currentTempo = props.tempos[0].bpm
      for (const t of props.tempos) {
        if (absoluteBeat >= t.offset) {
          currentTempo = t.bpm
        } else {
          break
        }
      }
      return currentTempo * (props.tempoMultiplier / 100)
    }

    const animate = (timestamp) => {
      if (!props.isRecording) return

      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      const currentTempo = getCurrentTempo(replayTime.value)
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

    const getYPosition = (midiNote) => {
      return canvas.value.height - (midiNote - minNotePitch + 2) * 10
    }

    return { canvas, replayTime, duration }
  },
}
</script>

<style scoped>
.visualizer-container {
  width: 70%;
  height: 100%;
  border: 1px solid black;
  overflow: hidden;
  background-color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: auto;
  margin-top: 50px;
}

canvas {
  width: 100%;
  height: 100%;
}
</style>
