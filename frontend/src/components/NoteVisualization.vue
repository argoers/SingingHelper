<template>
  <div class="visualizer-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script lang="js">
import { ref, onMounted, watch, computed, watchEffect } from 'vue'
import { midiToNote } from './ChartDisplay.vue'
import { getTimeSignature } from '../services/api'
import { useWindowSize } from '@vueuse/core'

export default {
  props: {
    midiNotes: Object,
    isRecording: Boolean,
    tempo: [Number, String],
    startBar: [Number, String],
    endBar: [Number, String],
  },
  setup(props) {
    const canvas = ref(null)
    let ctx = null
    let notes = []
    let animationFrameId
    let beatsPerBar
    let beatLength
    let pxPerBeat
    let pxPerSecond
    let scrollSpeed
    let firstNotePositionX
    let lastNotePositionX
    let minNotePitch = Math.min(...props.midiNotes.map((e) => e[2]))
    let maxNotePitch = Math.max(...props.midiNotes.map((e) => e[2]))
    let startTime
    //let endTime

    onMounted(async () => {
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
          animate()
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
    )

    const startBarComputed = computed(() => props.startBar)
    const endBarComputed = computed(() => props.endBar)
    const isRecordingComputed = computed(() => props.isRecording)
    const midiNotesComputed = computed(() => props.midiNotes)
    const tempoComputed = computed(() => props.tempo)
    let newFileOpened = true
    watch(midiNotesComputed, () => {
      minNotePitch = Math.min(...props.midiNotes.map((e) => e[2]))
      maxNotePitch = Math.max(...props.midiNotes.map((e) => e[2]))
      newFileOpened = true
      setUpNotes()
    })
    watch(tempoComputed, () => {
      if (tempoComputed.value) {
        setScrollSpeedAndTimes()
      }
    })
    watch([isRecordingComputed], () => {
      if (!isRecordingComputed.value) {
        setUpNotes()
      }
    })
    const setAllAnimationParameters = () => {
      pxPerBeat = props.tempo * (4 / beatLength)
      pxPerSecond = (pxPerBeat * props.tempo) / 60
      scrollSpeed = pxPerSecond / 60
      setScrollSpeedAndTimes()
    }

    const setScrollSpeedAndTimes = () => {
      if (!newFileOpened) {
        scrollSpeed = (pxPerBeat * props.tempo) / 60 / 60
      }
      startTime = (props.startBar - 1) * beatsPerBar * (60 / props.tempo)
      //endTime = props.endBar * beatsPerBar * (60 / props.tempo)
      lastNotePositionX =
        firstNotePositionX + (props.endBar - props.startBar + 1) * beatsPerBar * pxPerBeat
    }

    const setUpNotes = async () => {
      canvas.value.width = 0.7 * useWindowSize().width.value
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      try {
        const data = await getTimeSignature()
        beatsPerBar = data.numerator
        beatLength = data.denominator
      } catch (error) {
        errorMessage.value = error.message
      }

      if (newFileOpened) {
        setAllAnimationParameters()
        newFileOpened = false
      } else {
        setScrollSpeedAndTimes()
      }

      ctx = canvas.value.getContext('2d')

      notes = props.midiNotes.map((note) => ({
        pitch: note[2],
        x: firstNotePositionX + (note[0] - startTime) * pxPerSecond,
        y: getYPosition(note[2]),
        width: (note[1] - note[0]) * pxPerSecond,
        name: midiToNote(note[2]),
      }))

      notes = notes.filter((note) => note.x < lastNotePositionX)

      if (props.isRecording) {
        animate()
      }

      drawStaticNotes()
    }

    const drawStaticNotes = () => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      drawPlayhead()
      for (let i = 1; i * 10 < canvas.value.width; i++) {
        drawPlayhead(i)
      }
      notes = notes.filter((note) => note.x + note.width > firstNotePositionX)

      notes.forEach((note) => {
        drawNote(note)
      })
    }

    const drawNote = (note) => {
      const isActive = note.x <= firstNotePositionX && note.x + note.width > firstNotePositionX

      ctx.fillStyle = isActive ? 'orange' : 'blue' // Active notes are orange
      ctx.globalAlpha = isActive ? 1 : 0.5 // Inactive notes are semi-transparent
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent' // Add glow
      ctx.shadowBlur = isActive ? 10 : 0
      ctx.fillRect(note.x, note.y, note.width, 20)

      ctx.fillStyle = 'black'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, note.x + note.width / 2, note.y - 10)
    }
    const drawPlayhead = (i = 0) => {
      ctx.strokeStyle = i == 0 ? 'red' : 'grey'
      ctx.lineWidth = i == 0 ? 5 : 0.5
      ctx.beginPath()
      ctx.moveTo(i * pxPerBeat + firstNotePositionX, 0)
      ctx.lineTo(i * pxPerBeat + firstNotePositionX, canvas.value.height)
      ctx.stroke()
    }

    const animate = () => {
      if (!props.isRecording) return
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      drawPlayhead()
      for (let i = 1; i * 10 < canvas.value.width; i++) {
        drawPlayhead(i)
      }
      notes.forEach((note) => {
        drawNote(note)
        note.x -= scrollSpeed
      })

      notes = notes.filter((note) => note.x + note.width > 0)
      animationFrameId = requestAnimationFrame(animate)
    }

    const getYPosition = (midiNote) => {
      return canvas.value.height - (midiNote - minNotePitch + 2) * 10
    }

    watch([startBarComputed, endBarComputed], async () => {
      if (!startBarComputed.value || !endBarComputed.value) return
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
