<template>
  <div class="chart-container">
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script lang="js">
import { ref, onMounted, watch, watchEffect, nextTick } from 'vue'
import { getWhichBeatMeasureEndsWith, getCurrentTempo, getYPosition } from '../utils/animationUtils'

export default {
  props: {
    musicXmlNoteInfo: Object,
    isRecording: Boolean,
    speed: [Number, String],
    startMeasure: [Number, String],
    endMeasure: [Number, String],
    tempoInfo: Object,
    timeSignatureInfo: Object,
  },
  setup(props) {
    const canvas = ref(null)
    let ctx = null
    let notes = []
    let animationFrameId
    let pxPerBeat = 200
    let oneToneHeight = 30

    let firstNotePositionX
    let minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

    let elapsedBeats = 0
    let startBeat = 0
    let lastFrameTime = performance.now()

    onMounted(() => {
      nextTick(() => {
        setUpNotes()
        window.addEventListener('resize', setUpNotes)
      })
    })

    /*   watchEffect(() => {
      if (!canvas.value) return

      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = oneToneHeight * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      setUpNotes()
    })
 */
    watch(
      () => props.isRecording,
      (isRecording) => {
        elapsedBeats = startBeat
        if (isRecording) {
          lastFrameTime = performance.now()
          requestAnimationFrame(animate)
        } else {
          cancelAnimationFrame(animationFrameId)
          setUpNotes()
        }
      },
    )
    let lastNoteEndBeat = 0
    let measureBeats

    const setUpNotes = () => {
      if (!props.musicXmlNoteInfo.length) return

      // Convert bar numbers to beat offsets
      startBeat = getWhichBeatMeasureEndsWith(
        Number(props.startMeasure) - 1,
        props.timeSignatureInfo,
      )
      lastNoteEndBeat = getWhichBeatMeasureEndsWith(
        Number(props.endMeasure),
        props.timeSignatureInfo,
      )

      measureBeats = []
      for (let m = Number(props.startMeasure); m <= Number(props.endMeasure); m++) {
        const beat = getWhichBeatMeasureEndsWith(m, props.timeSignatureInfo)
        measureBeats.push(beat)
      }

      // Filter notes in range
      const notesInRange = props.musicXmlNoteInfo.filter((note) => {
        const noteStart = note.offset
        const noteEnd = note.offset + note.duration
        return noteEnd > startBeat && noteStart < lastNoteEndBeat
      })

      if (!notesInRange.length) return

      minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = (oneToneHeight / 2) * (maxNotePitch - minNotePitch + 5)
      firstNotePositionX = canvas.value.height
      console.log(canvas.value.width)
      ctx = canvas.value.getContext('2d')

      notes = notesInRange.map((note) => ({
        pitch: note.pitch,
        x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
        y: getYPosition(note.pitch, minNotePitch, canvas.value.height),
        width: note.duration * pxPerBeat,
        name: note.name,
        startBeat: note.offset - startBeat,
      }))

      notes = notes.filter((note) => note.x < firstNotePositionX + lastNoteEndBeat * pxPerBeat)

      if (props.isRecording) {
        elapsedBeats = 0
        lastFrameTime = performance.now()
        requestAnimationFrame(animate)
      }

      drawStaticNotes()
    }

    const animate = (timestamp) => {
      if (!props.isRecording) return

      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

      drawPlayheads()

      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      const currentTempo = getCurrentTempo(
        elapsedBeats,
        props.tempoInfo,
        props.speed,
        props.startMeasure,
      )

      const beatsPerSecond = currentTempo / 60
      let beatsThisFrame = deltaTimeSec * beatsPerSecond
      if (elapsedBeats + beatsThisFrame > lastNoteEndBeat) {
        beatsThisFrame = lastNoteEndBeat - elapsedBeats
        elapsedBeats = lastNoteEndBeat
      } else {
        elapsedBeats += beatsThisFrame
      }

      const scrollAmount = beatsThisFrame * pxPerBeat

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
      notes = notes.filter((note) => note.x + note.width > firstNotePositionX)
      notes.forEach((note) => {
        drawNote(note)
      })
      drawPlayheads()
    }

    const drawPlayheads = () => {
      // Fixed red playhead
      drawPlayhead(firstNotePositionX, true)

      // Moving grey measure lines
      measureBeats.forEach((beat) => {
        const x = firstNotePositionX + (beat - startBeat) * pxPerBeat - elapsedBeats * pxPerBeat
        if (x > 0 && x < canvas.value.width && x != firstNotePositionX) {
          drawPlayhead(x, false)
        }
      })
    }

    const drawNote = (note) => {
      const isActive = note.x <= firstNotePositionX && note.x + note.width > firstNotePositionX

      ctx.fillStyle = isActive ? 'orange' : 'blue'
      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent'
      ctx.shadowBlur = isActive ? 10 : 0
      ctx.fillRect(note.x, note.y, note.width, oneToneHeight)

      ctx.fillStyle = 'black'
      ctx.font = '25px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, note.x + note.width / 2, note.y - oneToneHeight / 2)
    }

    const drawPlayhead = (x, isFirst = false) => {
      ctx.strokeStyle = isFirst ? 'red' : 'grey'
      ctx.lineWidth = isFirst ? 5 : 5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.value.height)
      ctx.stroke()
    }

    watch([() => props.startMeasure, () => props.endMeasure], async () => {
      setUpNotes()
    })

    return { canvas }
  },
}
</script>

<style scoped></style>
