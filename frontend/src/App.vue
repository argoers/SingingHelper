<template>
  <button v-if="!applicationQuitted" @click="stopServers" class="stop-button">
    Quit Application
  </button>
  <p v-if="applicationQuitted">Close the tab/window</p>
  <div v-if="!applicationQuitted" class="container">
    <h2>Compare MIDI & Singing</h2>

    <div class="upload-section">
      <FileUpload
        @file-uploaded="handleFileUploaded"
        :isRecordingProcessActive="isInCountdown || isRecording || isProcessingAudio"
      />
      <p v-if="selectedFile">
        Selected file: <b>{{ selectedFile }}</b>
      </p>
    </div>

    <div v-if="fileUploaded">
      <label for="partSelect">Select Part:</label>
      <select id="partSelect" v-model="selectedPart" @change="fetchNotes">
        <option v-for="part in parts" :key="part" :value="part">{{ part }}</option>
      </select>
    </div>

    <div v-if="selectedPart" class="bar-selection">
      <label>Start Bar:</label>
      <input
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        type="text"
        v-model="startBarInput"
        @blur="sanitizeStartBar"
      />

      <label>End Bar:</label>
      <input
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        type="text"
        v-model="endBarInput"
        @blur="sanitizeEndBar"
      />

      <label>Tempo (%):</label>
      <input
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        type="text"
        v-model="tempoInput"
        @blur="sanitizeTempo"
      />
    </div>

    <label v-if="selectedPart">
      <input
        type="checkbox"
        v-model="isMetronomeEnabled"
        :disabled="isInCountdown || isRecording || isProcessingAudio"
      />
      Do you want to use the metronome?
    </label>

    <div>
      <button
        @click="startRecordingProcess"
        :disabled="isInCountdown"
        v-if="selectedPart"
        v-show="!isRecording && !isProcessingAudio"
      >
        {{ countdown > 0 ? `Recording starting in ${countdown}...` : 'Start Recording' }}
      </button>
      <button @click="cancelRecordingProcess" v-if="isRecording">Cancel Recording</button>
      <button
        @click="playFirstNote"
        :disabled="isNoteBeingPlayed"
        v-if="selectedPart"
        v-show="!isRecording && !isInCountdown && !isProcessingAudio"
      >
        Play First Note
      </button>
    </div>

    <div>
      <button @click="enableChart" v-if="chartData.datasets[1].data" v-show="!showChart">
        Show result chart
      </button>
      <button @click="enableChart" v-if="chartData.datasets[1].data" v-show="showChart">
        Hide result chart
      </button>
      <button @click="enableReplay" v-if="chartData.datasets[1].data" v-show="!showReplay">
        Show replay window
      </button>
      <button @click="enableReplay" v-if="chartData.datasets[1].data" v-show="showReplay">
        Hide replay window
      </button>
      <button @click="startReplay" v-if="chartData.datasets[1].data" v-show="!isReplaying">
        Start replay
      </button>
      <button @click="stopReplay" v-if="isReplaying">Stop replay</button>
    </div>

    <p v-if="isRecording">{{ loadingRecordingMessage }}</p>
    <p v-if="isProcessingAudio">{{ loadingProcessingMessage }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <NoteVisualization
      v-if="midiNotes"
      :midiNotes="midiNotes"
      :isRecording="isRecording"
      :tempoMultiplier="tempo"
      :startBar="startBar"
      :endBar="endBar"
      :tempos="tempos"
      :timeSignatures="timeSignatures"
    />

    <NoteReplay
      @stop-replay="stopReplay"
      v-if="chartData.datasets[1].data && chartData.datasets[0].data"
      v-show="showReplay"
      :midiNotesWithTimes="midiNotes"
      :midiNotes="chartData.datasets[0].data"
      :recordedNotes="chartData.datasets[1].data"
      :isRecording="isReplaying"
      :tempoMultiplier="tempo"
      :startBar="startBar"
      :endBar="endBar"
      :tempos="tempos"
      :timeSignatures="timeSignatures"
      :durationInSeconds="duration"
      :startTime="startTime"
    />

    <ChartDisplay
      v-if="chartData"
      v-show="showChart"
      :chart-data="chartData"
      :isRecordingCancelled="isRecordingCancelled"
    />
  </div>
</template>

<script lang="js">
import { ref, watch } from 'vue'
import FileUpload from './components/FileUpload.vue'
import ChartDisplay from './components/ChartDisplay.vue'
import {
  getMidiNotes,
  getParts,
  recordAudio,
  getTempo,
  getMidiStartTimeAndDurationFromMeasures,
  extractPitchesFromAudio,
  getBarInfo,
  getTimeSignature,
  quitApplication,
} from './services/api'
import metronomeSound from '@/assets/metronome.mp3'
import NoteVisualization from './components/NoteVisualization.vue'
import NoteReplay from './components/NoteReplay.vue'

export default {
  components: {
    FileUpload,
    ChartDisplay,
    NoteVisualization,
    NoteReplay,
  },
  setup() {
    const stopServers = async () => {
      try {
        await quitApplication()
        window.close()
      } catch (error) {
        console.error('Error stopping servers:', error)
      }
      applicationQuitted.value = true
    }

    const applicationQuitted = ref(false)
    const loadingRecordingMessage = ref('Sing now!')
    const loadingProcessingMessage = ref('Processing audio')
    const startBar = ref(1)
    const endBar = ref(1)
    const isInCountdown = ref(false)
    const isRecording = ref(false)
    const isProcessingAudio = ref(false)
    const isRecordingCancelled = ref(false)
    const errorMessage = ref('')
    const fileUploaded = ref(false)
    const chartData = ref({
      labels: [],
      datasets: [
        {
          label: 'MIDI Notes',
          borderColor: 'blue',
          backgroundColor: 'blue',
          pointRadius: 0,
          fill: false,
          stepped: 'before',
          //spanGaps: true,
        },
        {
          label: 'Sung Notes',
          borderColor: 'red',
          backgroundColor: 'red',
          pointRadius: 3,
          fill: false,
          stepped: 'before',
          //spanGaps: true,
        },
      ],
    })
    const selectedFile = ref('')
    const countdown = ref(0)
    const tempo = ref(100)
    const totalBars = ref(null)
    const defaultTempo = ref(null)
    const midiNotes = ref(null)
    const duration = ref(null)
    const isMetronomeEnabled = ref(false)
    const showChart = ref(true)
    const isNoteBeingPlayed = ref(false)
    const timeSignatures = ref([])
    const tempos = ref([])
    const barsInfo = ref(null)
    const startTime = ref(null)

    const parts = ref([]) // List of available parts
    const selectedPart = ref('') // Selected part

    let requestSession = 0
    let metronomeInterval = null
    const metronomeAudio = new Audio(metronomeSound)
    metronomeAudio.load()

    const fetchNotes = async () => {
      try {
        const response = await getBarInfo(selectedPart.value)
        console.log(response)
        barsInfo.value = response.bar_info

        const lastBar = barsInfo.value[barsInfo.value.length - 1].bar
        endBar.value = lastBar
        endBarInput.value = String(lastBar)
        totalBars.value = lastBar
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getTimeSignature(selectedPart.value)
        timeSignatures.value = response.time_signatures
        console.log(timeSignatures.value)
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getTempo()
        tempos.value = response.tempo
        defaultTempo.value = 100
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getMidiNotes(startBar.value, endBar.value, selectedPart.value)
        midiNotes.value = response.midi_notes
        console.log(midiNotes.value)
      } catch (error) {
        errorMessage.value = error.message
      }
    }
    const resetData = () => {
      chartData.value.labels = {}
      chartData.value.datasets[0].data = null
      chartData.value.datasets[1].data = null
    }

    const enableChart = () => {
      showChart.value = !showChart.value
    }

    const showReplay = ref(true)
    const isReplaying = ref(false)

    const stopReplay = () => {
      isReplaying.value = false
    }
    const enableReplay = () => {
      showReplay.value = !showReplay.value
    }

    const startReplay = () => {
      isReplaying.value = true
    }

    const handleFileUploaded = async (success) => {
      fileUploaded.value = success
      if (!success) {
        errorMessage.value = 'Select a MIDI file!'
        resetData()
        return
      }

      resetData()
      startBar.value = 1

      try {
        const response = await getParts()
        parts.value = response.parts
        console.log(parts.value)
      } catch (error) {
        errorMessage.value = error.message
      }
    }

    const playClickSound = (loud) => {
      const firstBeatVolume = loud ? 1 : 0.1
      const allBeatVolumeCoef = countdown.value > 1 ? 1 : 0.1
      metronomeAudio.currentTime = 0
      metronomeAudio.volume = firstBeatVolume * allBeatVolumeCoef
      metronomeAudio.play()
    }

    const playMetronome = () => {
      stopMetronome()

      let beatIndex = 0
      let currentOffset = 0 // Tracks total elapsed beats (offset based)
      let timeSignatureIndex = 0
      let tempoIndex = 0
      let lastTime = performance.now()

      const barStartBeat = barsInfo.value.find((b) => b.bar === startBar.value)?.start_beat ?? 0

      let applicableTS = timeSignatures.value[0]
      for (const ts of timeSignatures.value) {
        if (ts.offset <= barStartBeat) {
          applicableTS = ts
        } else {
          break
        }
      }

      let applicableTempo = tempos.value[0]
      for (const t of tempos.value) {
        if (t.offset <= barStartBeat) {
          applicableTempo = t
        } else {
          break
        }
      }
      let beatsPerBar = applicableTS.numerator

      let tempo = applicableTempo.bpm // Default tempo
      let secondsPerBeat = 60 / tempo
      let millisecondsPerBeat = secondsPerBeat * 1000

      const playNextBeat = () => {
        if (!isMetronomeEnabled.value) {
          stopMetronome()
          return
        }

        let now = performance.now()
        let elapsed = (now - lastTime) / 1000 // Convert to seconds
        lastTime = now
        currentOffset += elapsed / secondsPerBeat // Convert time to offset (beats)

        // Update time signature if needed
        while (
          timeSignatureIndex < timeSignatures.value.length &&
          timeSignatures.value[timeSignatureIndex].offset <= currentOffset
        ) {
          beatsPerBar = timeSignatures.value[timeSignatureIndex].numerator
          timeSignatureIndex++
        }

        // Update tempo dynamically
        while (
          tempoIndex < tempos.value.length &&
          tempos.value[tempoIndex].offset <= currentOffset
        ) {
          tempo = tempos.value[tempoIndex].bpm / (tempo.value / 100)
          secondsPerBeat = 60 / tempo
          millisecondsPerBeat = secondsPerBeat * 1000
          tempoIndex++
        }

        const isStrongBeat = beatIndex % beatsPerBar === 0
        playClickSound(isStrongBeat)

        beatIndex++

        metronomeInterval = setTimeout(
          playNextBeat,
          millisecondsPerBeat - (performance.now() - now),
        ) // Compensate for drift
      }

      playNextBeat()
    }

    const stopMetronome = () => {
      if (metronomeInterval) {
        clearInterval(metronomeInterval)
        metronomeInterval = null
      }
    }

    const playFirstNote = async () => {
      const audioCtx = new window.AudioContext()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      const firstNoteFrequency = midiNotes.value[0].pitch

      oscillator.frequency.setValueAtTime(
        440 * Math.pow(2, (firstNoteFrequency - 69) / 12),
        audioCtx.currentTime,
      )
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime)
      //gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      oscillator.start()
      isNoteBeingPlayed.value = true

      oscillator.stop(audioCtx.currentTime + 2)
      oscillator.onended = () => {
        isNoteBeingPlayed.value = false
      }
    }

    const startRecordingProcess = async () => {
      const currentSession = ++requestSession

      showChart.value = false
      showReplay.value = false
      isRecordingCancelled.value = false
      errorMessage.value = ''

      isInCountdown.value = true
      const barStartBeat = barsInfo.value.find((b) => b.bar === startBar.value)?.start_beat ?? 0

      let applicableTS = timeSignatures.value[0]
      for (const ts of timeSignatures.value) {
        if (ts.offset <= barStartBeat) {
          applicableTS = ts
        } else {
          break
        }
      }
      const numerator = applicableTS.numerator

      let applicableTempo = tempos.value[0]
      for (const t of tempos.value) {
        if (t.offset <= barStartBeat) {
          applicableTempo = t
        } else {
          break
        }
      }
      const bpm = applicableTempo.bpm
      const speedMultiplier = tempo.value / 100

      const clickInterval = 60 / bpm / speedMultiplier // in seconds
      const totalCountTime = numerator * clickInterval

      countdown.value = numerator
      let elapsedTime = 0
      let hasStartedRecording = false

      while (true) {
        const timeRemaining = totalCountTime - elapsedTime

        // Start recording when we're about to go under 1 second
        if (!hasStartedRecording && timeRemaining <= 1.0) {
          startRecordingAudio(currentSession)
          hasStartedRecording = true
        }

        if (timeRemaining <= 0) {
          break
        }

        if (isMetronomeEnabled.value) {
          playClickSound()
        }

        await new Promise((resolve) => setTimeout(resolve, clickInterval * 1000))

        elapsedTime += clickInterval
        countdown.value--
      }

      if (isMetronomeEnabled.value) {
        playMetronome(true)
      }

      isInCountdown.value = false
      isRecording.value = true
    }

    const startRecordingAudio = async (currentSession) => {
      try {
        await recordAudio(startBar.value, endBar.value, tempo.value)
      } catch (error) {
        errorMessage.value = error.message
      }
      if (currentSession !== requestSession || isRecordingCancelled.value) return

      isRecording.value = false

      if (isMetronomeEnabled.value) {
        stopMetronome()
      }
      isProcessingAudio.value = true

      try {
        const data = await extractPitchesFromAudio(startBar.value, endBar.value)
        if (currentSession === requestSession && !isRecordingCancelled.value) {
          chartData.value.datasets[1].data = data.liveNotes

          isProcessingAudio.value = false
          try {
            const data = await getMidiStartTimeAndDurationFromMeasures(
              startBar.value,
              endBar.value,
              tempo.value,
            )
            let numPoints = chartData.value.datasets[1].data.length

            duration.value = data.duration
            startTime.value = data.start_time

            /*
            function timeToBar(t) {
              let currentBar = barsInfo.value[startBar.value - 1].bar
              for (let i = 1; i < barsInfo.value.length; i++) {
                //console.log(t, barsInfo.value[i].start_time / (tempo.value / 100))
                if (t < barsInfo.value[i].start_time / (tempo.value / 100)) break
                currentBar = barsInfo.value[i].bar
              }
              return currentBar
            }
            const timeStep = data.duration / numPoints
            const timeAxis = Array.from(
              { length: numPoints },
              (_, i) => startTime.value + i * timeStep,
            )

            const labels = timeAxis.map((t, i) => {
              const currentBar = timeToBar(t)
              const prevBar = i > 0 ? timeToBar(timeAxis[i - 1]) : null
              return currentBar !== prevBar ? `Bar ${currentBar}` : ''
            })

            const midiMapped = timeAxis.map((t) => {
              const activeNote = midiNotes.value.find(
                (note) =>
                  note.start / (tempo.value / 100) <= t && t <= note.end / (tempo.value / 100),
              )
              return activeNote ? activeNote.pitch : null
            })
            */

            function beatToBar(t) {
              let currentBar = startBar.value
              for (let i = 1; i < barsInfo.value.length; i++) {
                if (t < barsInfo.value[i].start_beat) break
                currentBar = barsInfo.value[i].bar
              }

              return currentBar
            }

            const numBeats =
              barsInfo.value[endBar.value - 1].start_beat +
              barsInfo.value[endBar.value - 1].duration_beats -
              barsInfo.value[startBar.value - 1].start_beat
            const beatStep = numBeats / numPoints
            const beatAxis = Array.from(
              { length: numPoints },
              (_, i) => barsInfo.value[startBar.value - 1].start_beat + i * beatStep,
            )

            console.log(beatAxis, numBeats)

            let lastBara = 1
            const labels = beatAxis.map((t, i) => {
              const currentBar = beatToBar(t)
              if (currentBar != lastBara) console.log(t, i)
              lastBara = currentBar
              const prevBar = i > 0 ? beatToBar(beatAxis[i - 1]) : null
              return currentBar !== prevBar ? `Bar ${currentBar}` : ''
            })

            const midiMapped = beatAxis.map((t) => {
              const activeNote = midiNotes.value.find(
                (note) => note.offset <= t && t <= note.offset + note.duration,
              )
              return activeNote ? activeNote.pitch : null
            })

            chartData.value.datasets[0].data = midiMapped
            chartData.value.labels = labels
          } catch (error) {
            errorMessage.value = error.message
          }
        }
      } catch (error) {
        isProcessingAudio.value = false
        errorMessage.value = error.message
      }
      showChart.value = true
      showReplay.value = true
    }

    const cancelRecordingProcess = async () => {
      if (isMetronomeEnabled.value) {
        stopMetronome()
      }

      isRecordingCancelled.value = true
      isRecording.value = false
      isProcessingAudio.value = false
      errorMessage.value = 'Recording canceled!'
    }

    watch([startBar, endBar], async () => {
      if ((startBar.value && endBar.value) || endBar.value === 0 || startBar.value === 0) {
        if (endBar.value > totalBars.value) {
          endBar.value = totalBars.value
        } else if (endBar.value < startBar.value) {
          if (endBar.value === totalBars.value) {
            startBar.value = endBar.value
          } else {
            endBar.value = startBar.value
          }
        } else if (startBar.value <= 0) {
          startBar.value = 1
        }
      }
    })

    const tempoInput = ref('100') // user-visible string (with leading zeros if typed)
    const startBarInput = ref('1')
    const endBarInput = ref('1')

    const sanitizeTempo = () => {
      const parsed = Math.round(parseFloat(tempoInput.value))
      if (!isNaN(parsed) && parsed > 0) {
        tempo.value = parsed
        tempoInput.value = String(parsed) // Optionally strip leading zeros on blur
      } else {
        // fallback
        tempo.value = 100
        tempoInput.value = '100'
      }
    }

    const sanitizeStartBar = () => {
      const parsed = Math.round(parseFloat(startBarInput.value))
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalBars.value) {
        startBar.value = parsed
        startBarInput.value = String(parsed)
        if (endBar.value < startBar.value) {
          endBar.value = parsed
          endBarInput.value = String(parsed)
        }
      } else {
        startBar.value = 1
        startBarInput.value = '1'
      }
    }

    const sanitizeEndBar = () => {
      const parsed = Math.round(parseFloat(endBarInput.value))
      if (!isNaN(parsed) && parsed >= startBar.value && parsed <= totalBars.value) {
        endBar.value = parsed
        endBarInput.value = String(parsed)
      } else {
        endBar.value = totalBars.value
        endBarInput.value = String(totalBars.value)
      }
    }

    return {
      applicationQuitted,
      sanitizeEndBar,
      sanitizeStartBar,
      sanitizeTempo,
      startBarInput,
      endBarInput,
      tempoInput,
      startTime,
      timeSignatures,
      duration,
      tempos,
      fetchNotes,
      parts,
      selectedPart,
      defaultTempo,
      isReplaying,
      stopReplay,
      enableReplay,
      startReplay,
      showReplay,
      isNoteBeingPlayed,
      startRecordingProcess,
      showChart,
      enableChart,
      isMetronomeEnabled,
      stopServers,
      isInCountdown,
      isProcessingAudio,
      isRecording,
      midiNotes,
      loadingRecordingMessage,
      loadingProcessingMessage,
      startBar,
      endBar,
      errorMessage,
      fileUploaded,
      chartData,
      handleFileUploaded,
      startRecordingAudio,
      cancelRecordingProcess,
      selectedFile,
      isRecordingCancelled,
      countdown,
      playFirstNote,
      tempo,
    }
  },
}
</script>

<style scoped>
.container {
  text-align: center;
  max-width: 100%;
  margin: auto;
}

.upload-section {
  margin-bottom: 10px;
}

.bar-selection {
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  gap: 10px;
}

button {
  background-color: #4caf50;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 5px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error {
  color: red;
  font-weight: bold;
}
</style>
