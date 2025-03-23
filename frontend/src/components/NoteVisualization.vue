<template>
  <div class="visualizer-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script lang="js">
import { ref, onMounted, watch, watchEffect } from 'vue'
import { midiToNote } from './ChartDisplay.vue'
import { useWindowSize } from '@vueuse/core'

export default {
  props: {
    midiNotes: Object,
    isRecording: Boolean,
    tempo: [Number, String],
    startBar: [Number, String],
    endBar: [Number, String],
    tempos: Object,
    timeSignatures: Object,
    tempoMultiplier: [Number, String],
  },
  setup(props) {
    const canvas = ref(null)
    let ctx = null
    let notes = []
    let animationFrameId
    let pxPerBeat = 200

    let firstNotePositionX
    let lastNotePositionX
    let minNotePitch = Math.min(...props.midiNotes.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.midiNotes.map((e) => e.pitch))

    let elapsedBeats = 0
    let startBeat = 0
    let lastFrameTime = performance.now()

    onMounted(() => {
      setUpNotes()
    })

    watchEffect(() => {
      if (!canvas.value) return
      canvas.value.width = 0.7 * useWindowSize().width.value
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      setUpNotes()
    })

    watch(
      () => props.isRecording,
      (isRecording) => {
        if (isRecording) {
          elapsedBeats = startBeat
          lastFrameTime = performance.now()
          requestAnimationFrame(animate)
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
    )
    let lastNoteEndBeat = 0
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
      if (!props.midiNotes.length || !props.timeSignatures.length) return

      // Convert bar numbers to beat offsets
      startBeat = barToBeat(Number(props.startBar) - 1, props.timeSignatures)
      lastNoteEndBeat = barToBeat(Number(props.endBar), props.timeSignatures)

      // Filter notes in range
      const notesInRange = props.midiNotes.filter((note) => {
        const noteStart = note.offset
        const noteEnd = note.offset + note.duration
        return noteEnd > startBeat && noteStart < lastNoteEndBeat
      })

      if (!notesInRange.length) return

      minNotePitch = Math.min(...props.midiNotes.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.midiNotes.map((e) => e.pitch))

      canvas.value.width = 0.7 * useWindowSize().width.value
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height

      ctx = canvas.value.getContext('2d')

      // 🔁 Important: relative to startBeat!
      notes = notesInRange.map((note) => ({
        pitch: note.pitch,
        x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
        y: getYPosition(note.pitch),
        width: note.duration * pxPerBeat,
        name: midiToNote(note.pitch),
        startBeat: note.offset - startBeat, // relative
      }))

      notes = notes.filter((note) => note.x < firstNotePositionX + lastNoteEndBeat * pxPerBeat)

      if (props.isRecording) {
        elapsedBeats = 0
        lastFrameTime = performance.now()
        requestAnimationFrame(animate)
      }

      drawStaticNotes()
    }

    const getCurrentTempo = (beat) => {
      const absoluteBeat = beat + startBeat // adjust relative beat to global

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
    let lastTempo
    const animate = (timestamp) => {
      if (!props.isRecording) return

      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      for (let i = 0; i * 10 < canvas.value.width; i++) {
        drawPlayhead(i)
      }

      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      const currentTempo = getCurrentTempo(elapsedBeats)

      const beatsPerSecond = currentTempo / 60
      let beatsThisFrame = deltaTimeSec * beatsPerSecond
      if (elapsedBeats + beatsThisFrame > lastNoteEndBeat) {
        beatsThisFrame = lastNoteEndBeat - elapsedBeats
        elapsedBeats = lastNoteEndBeat
      } else {
        elapsedBeats += beatsThisFrame
      }

      const scrollAmount = beatsThisFrame * pxPerBeat

      //if (lastTempo !== currentTempo) console.log(deltaTimeSec, currentTempo, elapsedBeats)
      lastTempo = currentTempo

      notes.forEach((note) => {
        note.x -= scrollAmount
        drawNote(note)
      })

      notes = notes.filter((note) => note.x + note.width > 0)

      if (elapsedBeats >= lastNoteEndBeat) {
        cancelAnimationFrame(animationFrameId)
        return
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    const drawStaticNotes = () => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      for (let i = 0; i * 10 < canvas.value.width; i++) {
        drawPlayhead(i)
      }
      notes = notes.filter((note) => note.x + note.width > firstNotePositionX)
      notes.forEach((note) => {
        drawNote(note)
      })
    }

    const drawNote = (note) => {
      const isActive = note.x <= firstNotePositionX && note.x + note.width > firstNotePositionX

      ctx.fillStyle = isActive ? 'orange' : 'blue'
      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent'
      ctx.shadowBlur = isActive ? 10 : 0
      ctx.fillRect(note.x, note.y, note.width, 20)

      ctx.fillStyle = 'black'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, note.x + note.width / 2, note.y - 10)
    }

    const drawPlayhead = (i) => {
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

    watch([() => props.startBar, () => props.endBar], async () => {
      setUpNotes()
    })

    return { canvas }
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
