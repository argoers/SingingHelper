<template>
  <button @click="stopServers" class="stop-button">Quit Application</button>
  <div class="container">
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

    <div v-if="fileUploaded" class="bar-selection">
      <label>Start Bar:</label>
      <input
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        type="number"
        v-model="startBar"
        @focus="storeLastValidStartBar"
        @blur="resetStartBarIfEmpty"
      />

      <label>End Bar:</label>
      <input
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        type="number"
        v-model="endBar"
        @focus="storeLastValidEndBar"
        @blur="resetEndBarIfEmpty"
      />

      <div v-if="tempo !== null">
        <label>Tempo:</label>
        <input
          :disabled="isInCountdown || isRecording || isProcessingAudio"
          type="number"
          v-model="tempo"
          @focus="storeLastValidTempo"
          @blur="resetTempoIfEmpty"
        />
      </div>
    </div>

    <label v-if="fileUploaded">
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
        v-if="!isRecording && !isProcessingAudio && fileUploaded"
      >
        {{ countdown > 0 ? `Recording starting in ${countdown}...` : 'Start Recording' }}
      </button>
      <button @click="cancelRecordingProcess" v-if="isRecording">Cancel Recording</button>
      <button
        @click="playFirstNote"
        :disabled="isNoteBeingPlayed"
        v-if="!isRecording && !isInCountdown && !isProcessingAudio && fileUploaded"
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
      :tempo="tempo"
      :startBar="startBar"
      :endBar="endBar"
    />
    <NoteReplay @stop-replay="stopReplay"
      v-if="chartData.datasets[1].data && chartData.datasets[0].data"
      v-show="showReplay"
      :midiNotesWithTimes="midiNotes"
      :midiNotes="chartData.datasets[0].data"
      :recordedNotes="chartData.datasets[1].data"
      :isReplaying="isReplaying"
      :defaultTempo="defaultTempo"
      :tempo="tempo"
      :startBar="startBar"
      :endBar="endBar"
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
  recordAudio,
  getTempo,
  getMidiFileInfo,
  extractPitchesFromAudio,
  getBarTotal,
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
    }

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
    const tempo = ref(null)
    const totalBars = ref(null)
    const defaultTempo = ref(null)
    const midiNotes = ref(null)
    const timeSignature = ref(null)
    const isMetronomeEnabled = ref(false)
    const showChart = ref(true)
    const isNoteBeingPlayed = ref(false)

    let requestSession = 0
    let metronomeInterval = null
    const metronomeAudio = new Audio(metronomeSound)
    metronomeAudio.load()

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
        const response = await getTimeSignature()
        timeSignature.value = [response.numerator, response.denominator]
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getTempo()
        const correctTempo = (timeSignature.value[1] / 4) * response.tempo
        tempo.value = correctTempo
        defaultTempo.value = correctTempo
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getBarTotal()
        endBar.value = response.bar_total
        totalBars.value = response.bar_total
      } catch (error) {
        errorMessage.value = error.message
      }

      try {
        const response = await getMidiNotes(startBar.value, endBar.value)
        midiNotes.value = response.midiNotes
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

    const playMetronome = (loud) => {
      stopMetronome()
      playClickSound(loud)
      const beatsPerBar = timeSignature.value[0]
      let beatCount = 0
      const interval = (60 / tempo.value) * 1000
      metronomeInterval = setInterval(() => {
        beatCount = (beatCount + 1) % beatsPerBar
        playClickSound(beatCount === 0)
      }, interval)
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

      const firstNoteFrequency = midiNotes.value[0][2]

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
      countdown.value = timeSignature.value[0] * 2

      if (isMetronomeEnabled.value) {
        playMetronome(true)
      }

      while (countdown.value > 0) {
        if (countdown.value === 1) {
          startRecordingAudio(currentSession)
        }
        await new Promise((resolve) => setTimeout(resolve, (60 / tempo.value) * 1000))
        countdown.value--
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
            const data = await getMidiFileInfo(
              startBar.value,
              endBar.value,
              chartData.value.datasets[1].data.length,
            )
            chartData.value.datasets[0].data = data.midiNotesPoints
            chartData.value.labels = data.labels
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

    watch(tempo, async () => {
      if ((tempo.value && tempo.value < 0) || tempo.value === 0) {
        tempo.value = defaultTempo.value
      }
    })
    const resetTempoIfEmpty = () => {
      if (!tempo.value) {
        tempo.value = lastValidTempo.value
      }
    }
    const lastValidTempo = ref(null)

    const storeLastValidTempo = () => {
      lastValidTempo.value = tempo.value
    }

    const resetStartBarIfEmpty = () => {
      if (!startBar.value) {
        startBar.value = lastValidStartBar.value
      }
    }
    const lastValidStartBar = ref(null)

    const storeLastValidStartBar = () => {
      lastValidStartBar.value = startBar.value
    }
    const resetEndBarIfEmpty = () => {
      if (!endBar.value) {
        endBar.value = lastValidEndBar.value
      }
    }
    const lastValidEndBar = ref(null)

    const storeLastValidEndBar = () => {
      lastValidEndBar.value = endBar.value
    }

    return {
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
      storeLastValidStartBar,
      storeLastValidEndBar,
      resetEndBarIfEmpty,
      resetStartBarIfEmpty,
      resetTempoIfEmpty,
      storeLastValidTempo,
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
