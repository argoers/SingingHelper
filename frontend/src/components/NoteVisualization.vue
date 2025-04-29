<template>
  <!-- Main container for the canvas -->
  <div class="chart-container">
    <!-- Canvas where the animated notes will be drawn -->
    <canvas ref="canvas"></canvas>
  </div>
</template>

<script lang="ts">
// Import Vue composition API functions
import { ref, onMounted, watch, nextTick } from 'vue'

// Import helper functions for animation logic
import { getWhichBeatMeasureEndsWith, getCurrentTempo, getYPosition } from '../utils/animationUtils'

export default {
  props: {
    // MusicXML note data
    musicXmlNoteInfo: Object,
    // Whether recording is active
    isRecording: Boolean,
    // Playback speed multiplier
    speed: [Number, String],
    // First selected measure
    startMeasure: [Number, String],
    // Last selected measure
    endMeasure: [Number, String],
    // Tempo change information
    tempoInfo: Object,
    // Time signature information
    timeSignatureInfo: Object,
    // Selected voice part (e.g., Soprano)
    selectedPart: String,
  },
  setup(props) {
    // Canvas DOM element
    const canvas = ref(null)

    // 2D drawing context
    let ctx = null

    // List of notes currently on screen
    let notes = []

    // ID for animation frame
    let animationFrameId

    // Pixels per beat horizontally
    const pxPerBeat = 200

    // Pixels height per one tone (one semitone step)
    const oneToneHeight = 30

    // Starting x-position for notes
    const firstNotePositionX = 120

    // Min and max pitch of all notes
    let minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

    // Elapsed beats during recording
    let elapsedBeats

    // Start beat (offset for first note)
    let startBeat = 0

    // Timestamp of last animation frame
    let lastFrameTime = performance.now()

    // Setup notes when component mounts
    onMounted(() => {
      nextTick(() => {
        setUpNotes()
        window.addEventListener('resize', setUpNotes)
      })
    })

    // Watch when recording starts/stops
    watch(
      () => props.isRecording,
      (isRecording) => {
        if (isRecording) {
          // Reset elapsed beats and start animation
          elapsedBeats = startBeat
          lastFrameTime = performance.now()
          requestAnimationFrame(animate)
        } else {
          // Stop animation when recording stops
          cancelAnimationFrame(animationFrameId)
          setUpNotes()
        }
      },
    )

    // End beat for the last measure
    let lastNoteEndBeat = 0

    // Beat positions where measures end
    let measureBeats

    // Setup and prepare note positions and canvas
    const setUpNotes = () => {
      // Calculate where selected measures start and end
      startBeat = getWhichBeatMeasureEndsWith(
        Number(props.startMeasure) - 1,
        props.timeSignatureInfo,
      )
      lastNoteEndBeat = getWhichBeatMeasureEndsWith(
        Number(props.endMeasure),
        props.timeSignatureInfo,
      )

      // Build array of all measure beat offsets
      measureBeats = []
      for (let m = Number(props.startMeasure); m <= Number(props.endMeasure); m++) {
        const beat = getWhichBeatMeasureEndsWith(m, props.timeSignatureInfo)
        measureBeats.push(beat)
      }

      // Filter notes within selected measure range
      const notesInRange = props.musicXmlNoteInfo.filter((note) => {
        const noteStart = note.offset
        const noteEnd = note.offset + note.duration
        return noteEnd > startBeat && noteStart < lastNoteEndBeat
      })

      // Update min and max pitch range
      minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

      // Adjust canvas size based on content
      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = (oneToneHeight / 2) * (maxNotePitch - minNotePitch + 5)

      // Get 2D context
      ctx = canvas.value.getContext('2d')

      // Map MusicXML notes to internal format for rendering
      notes = notesInRange.map((note) => ({
        pitch: note.pitch,
        x: firstNotePositionX + (note.offset - startBeat) * pxPerBeat,
        y: getYPosition(note.pitch, minNotePitch, canvas.value.height, oneToneHeight),
        width: note.duration * pxPerBeat,
        name: note.name,
        startBeat: note.offset - startBeat,
      }))

      // Filter notes that would be drawn off-screen
      notes = notes.filter((note) => note.x < firstNotePositionX + lastNoteEndBeat * pxPerBeat)

      // Reset elapsed beats to start position
      elapsedBeats = startBeat

      // If recording, restart animation
      if (props.isRecording) {
        lastFrameTime = performance.now()
        requestAnimationFrame(animate)
      }

      // Initial static drawing
      drawStaticNotes()
    }

    // Animate function for note scrolling
    const animate = (timestamp) => {
      if (!props.isRecording) return

      // Clear entire canvas
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

      // Draw beat grid and playheads
      drawPlayheads()

      // Calculate time passed since last frame
      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      // Get current tempo (BPM) adjusted for speed
      const currentTempo = getCurrentTempo(
        elapsedBeats,
        props.tempoInfo,
        props.speed,
        props.startMeasure,
      )

      // Calculate beats per second
      const beatsPerSecond = currentTempo / 60

      // How many beats passed this frame
      let beatsThisFrame = deltaTimeSec * beatsPerSecond

      // If this frame would overshoot, limit to end
      if (elapsedBeats + beatsThisFrame > lastNoteEndBeat) {
        beatsThisFrame = lastNoteEndBeat - elapsedBeats
        elapsedBeats = lastNoteEndBeat
      } else {
        elapsedBeats += beatsThisFrame
      }

      // Scroll amount in pixels
      const scrollAmount = beatsThisFrame * pxPerBeat

      // Move notes leftward and redraw them
      notes.forEach((note) => {
        drawNote(note)
        note.x -= scrollAmount
      })

      // Remove notes that scrolled off the canvas
      notes = notes.filter((note) => note.x + note.width > 0)

      // Stop animation if end is reached
      if (elapsedBeats >= lastNoteEndBeat) {
        elapsedBeats = startBeat
        cancelAnimationFrame(animationFrameId)
        return
      }

      // Request next frame
      animationFrameId = requestAnimationFrame(animate)
    }

    // Redraw all static notes (no animation)
    const drawStaticNotes = () => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      notes = notes.filter((note) => note.x + note.width > firstNotePositionX)
      notes.forEach((note) => {
        drawNote(note)
      })
      drawPlayheads()
    }

    // Draw vertical lines for playheads (beat lines)
    const drawPlayheads = () => {
      drawPlayhead(firstNotePositionX, true) // Main start line
      measureBeats.forEach((beat) => {
        let x
        if (elapsedBeats == startBeat) {
          x = firstNotePositionX + (beat - startBeat) * pxPerBeat
        } else {
          x = firstNotePositionX + (beat - elapsedBeats) * pxPerBeat
        }

        if (x > 0 && x < canvas.value.width && x != firstNotePositionX) {
          drawPlayhead(x, false)
        }
      })
    }

    // Draw a single note rectangle with label
    const drawNote = (note) => {
      // Highlight active note
      const isActive = note.x <= firstNotePositionX && note.x + note.width > firstNotePositionX

      ctx.fillStyle = isActive ? 'orange' : 'blue'
      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent'
      ctx.shadowBlur = isActive ? 10 : 0
      ctx.fillRect(note.x, note.y, note.width, oneToneHeight)

      // Draw note name label
      ctx.fillStyle = 'black'
      ctx.font = '25px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, note.x + note.width / 2, note.y - oneToneHeight / 2)
    }

    // Draw a vertical playhead line
    const drawPlayhead = (x, isFirst = false) => {
      ctx.strokeStyle = isFirst ? 'red' : 'grey'
      ctx.lineWidth = isFirst ? 5 : 5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.value.height)
      ctx.stroke()
    }

    // Watch when measures or notes change to reset canvas
    watch([() => props.startMeasure, () => props.endMeasure, () => props.musicXmlNoteInfo], () => {
      setUpNotes()
    })

    // Return canvas reference
    return { canvas }
  },
}
</script>

<style scoped></style>
