<template>
  <div>
    <div class="visualizer-container">
      <canvas ref="canvas"></canvas>
    </div>
    <div class="progress-container">
      <input
        type="range"
        class="progress-bar"
        min="0"
        :max="totalReplayDuration"
        step="0.01"
        v-model="replayTime"
        @input="updateReplay"
      />
    </div>
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
    midiNotesWithTimes: Object,
    recordedNotes: Object,
    isReplaying: Boolean,
    isReplayWindowOpen: Boolean,
    defaultTempo: Number,
    tempo: [Number, String],
    startBar: [Number, String],
    endBar: [Number, String],
  },
  emits: ['stop-replay'],
  setup(props, { emit }) {
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
    let minNotePitch = Math.min(...props.midiNotes.filter((e) => e))
    let maxNotePitch = Math.max(...props.midiNotes.filter((e) => e))
    let startTime
    let endTime
    let oneSnippetLength
    const replayTime = ref(0) // Current replay position
    const totalReplayDuration = ref(0) // Total duration of the replay

    onMounted(async () => {
      setUpNotes()
    })

    watchEffect(() => {
      if (!canvas.value) return
      canvas.value.width = 0.7 * useWindowSize().width.value
      canvas.value.height = 10 * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      if (!newFileOpened) {
        setUpNotes()
      }
    })
    watch(
      () => props.isReplaying,
      (isReplaying) => {
        if (isReplaying) {
          animate()
        } else {
          cancelAnimationFrame(animationFrameId)
        }
      },
    )

    const midiNotesComputed = computed(() => props.midiNotes)
    const tempoComputed = computed(() => props.tempo)
    let newFileOpened = true
    watch(midiNotesComputed, () => {
      minNotePitch = Math.min(...props.midiNotes.filter((e) => e))
      maxNotePitch = Math.max(...props.midiNotes.filter((e) => e))
      newFileOpened = true
      setUpNotes()
    })
    watch(tempoComputed, () => {
      if (tempoComputed.value) {
        setScrollSpeedAndTimes()
      }
    })
    
    const setAllAnimationParameters = () => {
      pxPerBeat = props.defaultTempo * (4 / beatLength)
      pxPerSecond = (pxPerBeat * props.defaultTempo) / 60
      scrollSpeed = pxPerSecond / 60
      oneSnippetLength =
        ((props.endBar - props.startBar + 1) * beatsPerBar * (60 / props.defaultTempo)) /
        props.midiNotes.length
      setScrollSpeedAndTimes()
    }

    const setScrollSpeedAndTimes = () => {
      startTime = (props.startBar - 1) * beatsPerBar * (60 / props.tempo)
      endTime = props.endBar * beatsPerBar * (60 / props.tempo)
      totalReplayDuration.value = endTime - startTime
      if (!newFileOpened) {
        scrollSpeed = (pxPerBeat * props.tempo) / 60 / 60
      }

      lastNotePositionX =
        firstNotePositionX + (props.endBar - props.startBar + 1) * beatsPerBar * pxPerBeat
    }
    watch(replayTime, () => {
      drawStaticNotes()
    })

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

      notes = props.midiNotes.map((note, i) => ({
        pitch: note,
        x: firstNotePositionX + i * oneSnippetLength * pxPerSecond,
        y: getYPosition(note),
        width: oneSnippetLength * pxPerSecond,
        name: midiToNote(note),
        isCorrect: props.recordedNotes[i] <= note + 0.25 && props.recordedNotes[i] >= note - 0.25,
      }))
      console.log(notes)

      notes = notes.filter((note) => note.pitch)
      //console.log(props.recordedNotes, props.midiNotes, props.midiNotesWithTimes)
      notes = notes.filter((note) => note.x < lastNotePositionX)

      notes = removeNamesFromConsecutiveNotes(notes)
      if (props.isReplaying) {
        animate()
      }
      drawStaticNotes()
    }

    const removeNamesFromConsecutiveNotes = (notes) => {
      if (!notes.length) return []

      let mergedNotes = []
      let midiNotesWithTimesPointer = 0
      let currentNote = { ...notes[0] }
      let start = 0
      const midiNotesWithTimes = props.midiNotesWithTimes.filter(
        (note) => note[0] >= startTime && note[0] < endTime,
      )

      for (let i = 1; i < notes.length; i++) {
        if (notes[i].pitch === currentNote.pitch) {
          continue
        } else {
          let end = i - 1
          let splitParts = 0

          while (
            midiNotesWithTimesPointer < midiNotesWithTimes.length &&
            currentNote.pitch === midiNotesWithTimes[midiNotesWithTimesPointer][2]
          ) {
            splitParts++
            midiNotesWithTimesPointer++
          }

          let step = Math.floor((end - start + 1) / splitParts)
          let splitIndexes = []

          for (let s = 0; s < splitParts; s++) {
            let index = start + Math.floor(step / 2) + s * step
            if (index <= end) {
              splitIndexes.push(index)
            }
          }

          for (let j = start; j <= end; j++) {
            if (!splitIndexes.includes(j)) {
              notes[j].name = ''
            }
            mergedNotes.push({ ...notes[j] })
          }

          currentNote = { ...notes[i] }
          start = i
        }
      }

      let end = notes.length - 1
      let splitParts = 0
      while (
        midiNotesWithTimesPointer < midiNotesWithTimes.length &&
        currentNote.pitch === midiNotesWithTimes[midiNotesWithTimesPointer][2]
      ) {
        splitParts++
        midiNotesWithTimesPointer++
      }

      let step = Math.floor((end - start + 1) / splitParts)
      let splitIndexes = []

      for (let s = 0; s < splitParts; s++) {
        let index = start + Math.floor(step / 2) + s * step
        if (index <= end) {
          splitIndexes.push(index)
        }
      }

      for (let j = start; j <= end; j++) {
        if (!splitIndexes.includes(j)) {
          notes[j].name = ''
        }
        mergedNotes.push({ ...notes[j] })
      }

      return mergedNotes
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
      ctx.fillStyle = note.isCorrect ? 'green' : 'red'
      ctx.fillRect(note.x - replayTime.value * pxPerSecond, note.y, note.width, 20)
      ctx.fillStyle = 'black'
      ctx.font = '14px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, note.x - replayTime.value * pxPerSecond + note.width / 2, note.y - 10)
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
      if (!props.isReplaying) return
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
      if (notes.length === 0) {
        emit('stop-replay')
        setUpNotes()
      }
      animationFrameId = requestAnimationFrame(animate)
    }

    const getYPosition = (midiNote) => {
      return canvas.value.height - (midiNote - minNotePitch + 2) * 10
    }

    /* watch([startBarComputed, endBarComputed], async () => {
      if (!startBarComputed.value || !endBarComputed.value) return
      setUpNotes()
    }) */

    return { canvas, replayTime, totalReplayDuration }
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
.progress-container {
  width: 100%;
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

.progress-bar {
  width: 30%;
  appearance: none;
  height: 6px;
  background: #ccc;
  border-radius: 3px;
  outline: none;
  transition: background 0.3s;
}

.progress-bar::-webkit-slider-thumb {
  appearance: none;
  width: 12px;
  height: 12px;
  background: red;
  border-radius: 50%;
  cursor: pointer;
}
</style>
