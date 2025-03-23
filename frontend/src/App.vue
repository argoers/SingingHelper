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

    <BarSelection
      :selectedPart="selectedPart"
      :disabled="isInCountdown || isRecording || isProcessingAudio"
      :totalBars="totalBars"
      v-model:startBar="startBar"
      v-model:endBar="endBar"
      v-model:tempo="tempo"
    />

    <label v-if="selectedPart">
      <input
        type="checkbox"
        v-model="isMetronomeEnabled"
        :disabled="isInCountdown || isRecording || isProcessingAudio"
      />
      Do you want to use the metronome?
    </label>

    <RecordingControls
      :selectedPart="selectedPart"
      :isRecording="isRecording"
      :isProcessingAudio="isProcessingAudio"
      :isNoteBeingPlayed="isNoteBeingPlayed"
      :isInCountdown="isInCountdown"
      :countdown="countdown"
      :disabled="isInCountdown || isRecording || isProcessingAudio"
      @start-recording="startRecordingProcess"
      @cancel-recording="cancelRecordingProcess"
      @play-first-note="playFirstNote"
    />

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
      v-if="chartData.datasets[1].data && chartData.datasets[0].data"
      :midiNotesWithTimes="midiNotes"
      :midiNotes="chartData.datasets[0].data"
      :recordedNotes="chartData.datasets[1].data"
      :isRecording="isReplaying"
      :tempo="tempo"
      :tempoMultiplier="tempo"
      :startBar="startBar"
      :endBar="endBar"
      :tempos="tempos"
      :timeSignatures="timeSignatures"
      :durationInSeconds="duration"
      :startTime="startTime"
      :showReplay="showReplay"
      @toggle-replay="showReplay = !showReplay"
      @start-replay="startReplay"
      @stop-replay="stopReplay"
    />

    <ChartDisplay
      v-if="chartData.labels.length > 0"
      :chart-data="chartData"
      :isRecordingCancelled="isRecordingCancelled"
      :showChart="showChart"
      @toggle-chart="showChart = !showChart"
    />
  </div>
</template>

<script lang="js">
import { ref, watch } from 'vue'
import FileUpload from './components/FileUpload.vue'
import ChartDisplay from './components/ChartDisplay.vue'
import NoteVisualization from './components/NoteVisualization.vue'
import NoteReplay from './components/NoteReplay.vue'
import { useMetronome } from '@/composables/useMetronome'
import { useRecording } from '@/composables/useRecording'
import { useNotePlayback } from '@/composables/useNotePlayback'
import BarSelection from './components/BarSelection.vue'
import RecordingControls from './components/RecordingControls.vue'
import {
  getMidiNotes,
  getParts,
  getTempo,
  getBarInfo,
  getTimeSignature,
  quitApplication,
} from './services/api'

export default {
  components: {
    FileUpload,
    ChartDisplay,
    NoteVisualization,
    NoteReplay,
    BarSelection,
    RecordingControls,
  },
  setup() {
    const applicationQuitted = ref(false)
    const stopServers = async () => {
      try {
        await quitApplication()
        window.close()
      } catch (error) {
        console.error('Error stopping servers:', error)
      }
      applicationQuitted.value = true
    }

    const isMetronomeEnabled = ref(false)
    const fileUploaded = ref(false)
    const startBar = ref(1)
    const endBar = ref(1)
    const tempo = ref(100)
    const totalBars = ref(null)
    const selectedFile = ref('')
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
        },
        {
          label: 'Sung Notes',
          borderColor: 'red',
          backgroundColor: 'red',
          pointRadius: 3,
          fill: false,
          stepped: 'before',
        },
      ],
    })
    const parts = ref([])
    const selectedPart = ref(null)
    const timeSignatures = ref([])
    const tempos = ref([])
    const barsInfo = ref(null)
    const defaultTempo = ref(null)
    const midiNotes = ref(null)
    const startTime = ref(null)
    const duration = ref(null)

    const { playMetronome, stopMetronome, playClickSound } = useMetronome(
      timeSignatures,
      tempos,
      tempo,
      barsInfo,
      isMetronomeEnabled,
    )

    const { isNoteBeingPlayed, playFirstNote } = useNotePlayback(midiNotes)

    const {
      isInCountdown,
      isRecording,
      isProcessingAudio,
      isRecordingCancelled,
      countdown,
      showChart,
      showReplay,
      isReplaying,
      loadingRecordingMessage,
      loadingProcessingMessage,
      errorMessage,
      startRecordingProcess,
      cancelRecordingProcess,
      stopReplay,
      enableReplay,
      startReplay,
    } = useRecording({
      startBar,
      endBar,
      tempo,
      chartData,
      midiNotes,
      barsInfo,
      timeSignatures,
      tempos,
      playClickSound,
      playMetronome,
      stopMetronome,
      isMetronomeEnabled,
      setStartTime: (v) => (startTime.value = v),
      setDuration: (v) => (duration.value = v),
      setError: (e) => (errorMessage.value = e),
    })

    const fetchNotes = async () => {
      try {
        const response = await getBarInfo(selectedPart.value)
        barsInfo.value = response.bar_info
        const lastBar = barsInfo.value[barsInfo.value.length - 1].bar
        endBar.value = lastBar
        totalBars.value = lastBar
      } catch (error) {
        errorMessage.value = error.message
      }
      try {
        const response = await getTimeSignature(selectedPart.value)
        timeSignatures.value = response.time_signatures
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
      } catch (error) {
        errorMessage.value = error.message
      }
    }

    const handleFileUploaded = async (success) => {
      fileUploaded.value = success
      if (!success) {
        errorMessage.value = 'Select a MIDI file!'
        chartData.value.labels = {}
        chartData.value.datasets[0].data = null
        chartData.value.datasets[1].data = null
        return
      }
      chartData.value.labels = {}
      chartData.value.datasets[0].data = null
      chartData.value.datasets[1].data = null
      startBar.value = 1
      try {
        const response = await getParts()
        parts.value = response.parts
      } catch (error) {
        errorMessage.value = error.message
      }
    }

    return {
      applicationQuitted,
      stopServers,
      selectedFile,
      fileUploaded,
      handleFileUploaded,
      parts,
      selectedPart,
      fetchNotes,
      startBar,
      endBar,
      tempo,
      totalBars,
      isMetronomeEnabled,
      playFirstNote,
      isNoteBeingPlayed,
      startRecordingProcess,
      cancelRecordingProcess,
      countdown,
      isInCountdown,
      isRecording,
      isProcessingAudio,
      isRecordingCancelled,
      errorMessage,
      chartData,
      showChart,
      showReplay,
      enableReplay,
      startReplay,
      stopReplay,
      isReplaying,
      loadingRecordingMessage,
      loadingProcessingMessage,
      midiNotes,
      timeSignatures,
      tempos,
      barsInfo,
      startTime,
      duration,
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
