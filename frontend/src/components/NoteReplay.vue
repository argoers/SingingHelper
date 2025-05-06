<template>
  <!-- Card container -->
  <div class="card">
    <!-- Section title -->
    <h2 class="section-title">Laulmise tulemus</h2>

    <!-- Controls for replaying performance -->
    <div class="card" v-if="recordedNotes && musicXmlNotesMappedToBeats">
      <div class="input-group">
        <!-- Toggle showing/hiding replay view -->
        <button :disabled="isRecording" @click="$emit('toggle-replay')">
          {{ showReplay ? 'Peida' : 'Näita' }}
        </button>
        <!-- Start replay -->
        <button :disabled="isRecording" v-if="!isReplaying" @click="$emit('start-replay')">
          Käivita
        </button>
        <!-- Stop replay -->
        <button :disabled="isRecording" v-if="isReplaying" @click="$emit('stop-replay')">
          Peata
        </button>
      </div>
    </div>

    <!-- Replay view section -->
    <div v-show="showReplay">
      <div class="chart-container">
        <!-- Canvas for drawing notes and progress -->
        <canvas ref="canvas"></canvas>
      </div>
      <div>
        <!-- Slider to manually move the replay time -->
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
// Import Vue features
import { ref, onMounted, watch, nextTick } from 'vue'

// Import helper functions for beat and pitch calculation
import { getWhichBeatMeasureEndsWith, getCurrentTempo, getYPosition } from '../utils/animationUtils'

export default {
  // Define props passed from parent
  props: {
    musicXmlNoteInfo: Object, // Info about MusicXML notes
    musicXmlNotesMappedToBeats: Object, // Mapping of beats to time
    recordedNotes: Object, // Recorded singing pitch data
    isReplaying: Boolean, // Replay state
    isRecording: Boolean, // Recording state
    startMeasure: [Number, String], // Start measure number
    endMeasure: [Number, String], // End measure number
    tempoInfo: Object, // Tempo change data
    durationInSeconds: Number, // Total duration
    speed: [Number, String], // Speed multiplier
    timeSignatureInfo: Object, // Time signature changes
    startTime: Number, // Starting time offset
    showReplay: Boolean, // Whether replay view is shown
  },
  emits: ['stop-replay', 'start-replay', 'toggle-replay'], // Events emitted upwards

  setup(props, { emit }) {
    // Canvas reference
    const canvas = ref(null)

    // 2D drawing context
    let ctx = null

    // Notes to draw
    let notes = []

    // Animation frame ID
    let animationFrameId

    // Pixels per beat for scrolling horizontally
    const pxPerBeat = 200

    // Height per tone
    const oneToneHeight = 30

    // X-position where the playhead is fixed
    const firstNotePositionX = 120

    // Minimum and maximum pitch found
    let minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
    let maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

    // Replay progress (how much has been replayed)
    const replayTime = ref(0)

    // Duration in beats
    const duration = ref(null)

    // Track last frame timestamp
    let lastFrameTime = performance.now()

    // Starting beat offset
    let startBeat = 0

    // Store start and end measures when mounted
    let startMeasureOnMount
    let endMeasureOnMount

    // List of beats where measures end
    let measureBeats

    // Setup canvas and notes after mount
    onMounted(() => {
      nextTick(() => {
        startMeasureOnMount = props.startMeasure
        endMeasureOnMount = props.endMeasure
        setUpNotes()
        window.addEventListener('resize', setUpNotes)
      })
    })

    // Redraw static notes when replay time changes (only when not replaying)
    watch(replayTime, () => {
      if (!props.isReplaying) {
        drawStaticNotes()
      }
    })

    // Rebuild note data if recorded notes change
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

    // Handle when replay starts and stops
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

    // Setup notes, beat grid and canvas
    const setUpNotes = () => {
      if (!props.musicXmlNoteInfo.length || !props.recordedNotes.length || !canvas.value.getContext)
        return

      // Recalculate min/max pitches
      minNotePitch = Math.min(...props.musicXmlNoteInfo.map((e) => e.pitch))
      maxNotePitch = Math.max(...props.musicXmlNoteInfo.map((e) => e.pitch))

      // Find beat position at start and end
      startBeat = getWhichBeatMeasureEndsWith(startMeasureOnMount - 1, props.timeSignatureInfo)
      const endBeat = getWhichBeatMeasureEndsWith(endMeasureOnMount, props.timeSignatureInfo)

      // Build array of beat markers
      measureBeats = []
      for (let m = Number(props.startMeasure); m <= Number(props.endMeasure); m++) {
        const beat = getWhichBeatMeasureEndsWith(m, props.timeSignatureInfo)
        measureBeats.push(beat)
      }

      // Setup canvas size
      ctx = canvas.value.getContext('2d')
      canvas.value.width = canvas.value.parentElement.getBoundingClientRect().width
      canvas.value.height = (oneToneHeight / 2) * (maxNotePitch - minNotePitch + 5)

      // Time interval between mapped points
      const splitLength = props.durationInSeconds / props.musicXmlNotesMappedToBeats.length

      // Map MusicXML notes with their time mappings
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

      // Filter out notes that have no matching playback
      notes = notes.filter((e) => e.timeIndexes.length > 0 && e.x + e.width > firstNotePositionX)

      duration.value = endBeat - startBeat

      drawStaticNotes()
    }

    // Main animation loop for replay
    const animate = (timestamp) => {
      if (!props.isReplaying) return

      const deltaTimeSec = (timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp

      const currentTempo = getCurrentTempo(
        replayTime.value,
        props.tempoInfo,
        props.speed,
        startBeat,
      )

      const beatsPerSecond = currentTempo / 60
      const beatsThisFrame = deltaTimeSec * beatsPerSecond

      replayTime.value += beatsThisFrame

      const lastNote = notes[notes.length - 1]

      // If last note ends, stop replay
      if (lastNote && replayTime.value >= lastNote.startBeat + lastNote.duration - startBeat) {
        emit('stop-replay')
        cancelAnimationFrame(animationFrameId)
        replayTime.value = 0
        return
      }

      drawStaticNotes()
      animationFrameId = requestAnimationFrame(animate)
    }

    // Draw all notes and measure lines
    const drawStaticNotes = () => {
      ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
      drawPlayheads()
      notes.forEach((note) => {
        drawNote(note)
      })
    }

    // Draw individual note
    const drawNote = (note) => {
      const noteScreenX = note.x - replayTime.value * pxPerBeat

      const isActive =
        noteScreenX <= firstNotePositionX && noteScreenX + note.width > firstNotePositionX

      ctx.globalAlpha = isActive ? 1 : 0.5
      ctx.shadowColor = isActive ? 'rgba(255, 165, 0, 0.8)' : 'transparent'
      ctx.shadowBlur = isActive ? 10 : 0

      // For each recording time slice, color red/green
      note.timeIndexes.forEach((frameIdx, i) => {
        const pitchAtFrame = props.recordedNotes[frameIdx]
        ctx.fillStyle =
          pitchAtFrame <= note.pitch + 0.05 && pitchAtFrame >= note.pitch - 0.05 ? 'green' : 'red'

        const barWidth = note.width / note.timeIndexes.length
        ctx.fillRect(noteScreenX + barWidth * i, note.y, barWidth, oneToneHeight)
      })

      // Draw note label
      ctx.fillStyle = 'black'
      ctx.font = '25px Arial'
      ctx.textAlign = 'center'
      ctx.fillText(note.name, noteScreenX + note.width / 2, note.y - oneToneHeight / 2)
    }

    // Draw playheads for measure lines
    const drawPlayheads = () => {
      drawPlayhead(firstNotePositionX, true)

      measureBeats.forEach((beat) => {
        const x = firstNotePositionX + (beat - startBeat - replayTime.value) * pxPerBeat
        if (x > 0 && x < canvas.value.width && x != firstNotePositionX) {
          drawPlayhead(x, false)
        }
      })
    }

    // Draw vertical line (playhead)
    const drawPlayhead = (x, isFirst = false) => {
      ctx.strokeStyle = isFirst ? 'red' : 'grey'
      ctx.lineWidth = isFirst ? 5 : 5
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, canvas.value.height)
      ctx.stroke()
    }

    // Return variables to template
    return { canvas, replayTime, duration }
  },
}
</script>

<style scoped></style>
