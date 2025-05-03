<template>
  <!-- Button to stop servers (quits backend) -->
  <button v-if="!applicationQuitted" @click="stopServers" class="button">Sulge rakendus</button>

  <!-- Message shown after application quit -->
  <p v-if="applicationQuitted">Sulge aken</p>

  <!-- Main container, hidden after quitting -->
  <div v-if="!applicationQuitted" class="container">
    <h2>MusicXML-faili ja laulmise võrdlus</h2>

    <!-- Upload MusicXML file -->
    <div class="card">
      <FileUpload
        @file-uploaded="handleFileUploaded"
        :isRecordingProcessActive="isInCountdown || isRecording || isProcessingAudio"
      />

      <!-- Display uploaded file name -->
      <p v-if="selectedFile">
        Fail: <b>{{ selectedFile }}</b>
      </p>

      <!-- Dropdown to select part (e.g., Soprano, Alto) -->
      <div v-if="fileUploaded" class="dropdown">
        <label for="partSelect">Partii:</label>
        <select
          id="partSelect"
          v-model="selectedPart"
          @change="fetchInfo"
          :disabled="isInCountdown || isRecording || isProcessingAudio"
        >
          <option v-for="part in parts" :key="part" :value="part">{{ part }}</option>
        </select>
      </div>

      <!-- Display error if file upload fails -->
      <p v-if="errorMessage && errorMessage.includes('fail')" class="error">{{ errorMessage }}</p>
    </div>

    <!-- Section for selecting measures and metronome control -->
    <div class="card" v-show="selectedPart && musicXmlNoteInfo !== null">
      <MeasureAndSpeedSelection
        :selectedPart="selectedPart"
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        :totalMeasures="totalMeasures"
        :tempoInfo="tempoInfo"
        :timeSignatureInfo="timeSignatureInfo"
        v-model:startMeasure="startMeasure"
        v-model:endMeasure="endMeasure"
        v-model:speed="speed"
      />

      <!-- Enable or disable metronome during singing -->
      <label v-if="selectedPart">
        <input
          type="checkbox"
          v-model="isMetronomeEnabled"
          :disabled="isInCountdown || isRecording || isProcessingAudio"
        />
        Metronoom laulmise ajal
      </label>
    </div>

    <!-- Section for recording controls and live visualization -->
    <div class="card" v-show="selectedPart && musicXmlNoteInfo !== null">
      <RecordingControls
        :selectedPart="selectedPart"
        :isRecording="isRecording"
        :isProcessingAudio="isProcessingAudio"
        :isNoteBeingPlayed="isNoteBeingPlayed"
        :isInCountdown="isInCountdown"
        :countdown="countdown"
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        :musicXmlNoteInfo="musicXmlNoteInfo"
        :isSnippetPlaying="isPlayingSnippet"
        :isInTheMiddleOfSnippet="isInTheMiddleOfSnippet"
        @start-recording="startRecordingProcess"
        @cancel-recording="cancelRecordingProcess"
        @play-first-note="playNote(musicXmlNoteInfo, false)"
        @toggle-snippet-play="playSnippet"
        @reset-snippet="updateInTheMiddleOfSnippet"
      />

      <!-- Status messages during recording or audio processing -->
      <p v-if="isRecording">{{ loadingRecordingMessage }}</p>
      <p v-if="isProcessingAudio">{{ loadingProcessingMessage }}</p>
      <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

      <!-- Visualize MusicXML notes while recording -->
      <NoteVisualization
        v-if="musicXmlNoteInfo"
        :musicXmlNoteInfo="musicXmlNoteInfo"
        :isRecording="isRecording"
        :speed="speed"
        :startMeasure="startMeasure"
        :endMeasure="endMeasure"
        :tempoInfo="tempoInfo"
        :timeSignatureInfo="timeSignatureInfo"
        :selectedPart="selectedPart"
        :isPlayingSnippet="isPlayingSnippet"
        :isInTheMiddleOfSnippet="isInTheMiddleOfSnippet"
        :isInCountdown="isInCountdown"
        @toggle-snippet-play="playSnippet"
        @update-in-the-middle-of-snippet="updateInTheMiddleOfSnippet"
      />
    </div>

    <!-- Replay recorded notes vs MusicXML notes -->
    <NoteReplay
      v-if="chartData.datasets[1].data && chartData.datasets[0].data"
      v-show="chartData.datasets[1].data && chartData.datasets[0].data"
      :musicXmlNoteInfo="musicXmlNoteInfo"
      :musicXmlNotesMappedToBeats="chartData.datasets[0].data"
      :recordedNotes="chartData.datasets[1].data"
      :isReplaying="isReplaying"
      :isRecording="isInCountdown || isRecording || isProcessingAudio"
      :speed="speed"
      :startMeasure="startMeasure"
      :endMeasure="endMeasure"
      :tempoInfo="tempoInfo"
      :timeSignatureInfo="timeSignatureInfo"
      :durationInSeconds="duration"
      :startTime="startTime"
      :showReplay="showReplay"
      @toggle-replay="showReplay = !showReplay"
      @start-replay="startReplay"
      @stop-replay="stopReplay"
    />

    <!-- Display chart of MusicXML vs recording -->
    <ChartDisplay
      v-if="chartData.labels.length > 0"
      v-show="chartData.labels.length > 0"
      :chart-data="chartData"
      :isRecordingCancelled="isRecordingCancelled"
      :showChart="showChart"
      :isRecording="isInCountdown || isRecording || isProcessingAudio"
      @toggle-chart="showChart = !showChart"
    />
  </div>
</template>

<script lang="ts">
// Import core Vue features
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

// Import child components
import FileUpload from './components/FileUpload.vue'
import ChartDisplay from './components/ChartDisplay.vue'
import NoteVisualization from './components/NoteVisualization.vue'
import NoteReplay from './components/NoteReplay.vue'
import MeasureAndSpeedSelection from './components/MeasureAndSpeedSelection.vue'
import RecordingControls from './components/RecordingControls.vue'

// Import composables for reusable logic
import { useMetronome } from '@/composables/useMetronome'
import { useRecording } from '@/composables/useRecording'
import { useNotePlayback } from '@/composables/useNotePlayback'

// Import API functions
import {
  getMusicXmlNoteInfo,
  getPartNames,
  getTempoInfo,
  getMeasureInfo,
  getTimeSignatureInfo,
  quitApplication,
} from './services/api'

export default {
  components: {
    FileUpload,
    ChartDisplay,
    NoteVisualization,
    NoteReplay,
    MeasureAndSpeedSelection,
    RecordingControls,
  },
  setup() {
    // Track if application is closed
    const applicationQuitted = ref(false)

    // Stop servers and close frontend window
    const stopServers = async () => {
      try {
        await quitApplication()
        window.close()
      } catch (error) {
        console.error('Error stopping servers:', error)
      }
      applicationQuitted.value = true
    }

    const isPlayingSnippet = ref(false)
    const playSnippet = () => {
      // Logic to play a snippet of the music
      isPlayingSnippet.value = !isPlayingSnippet.value
    }

    // Track if the user is in the middle of a snippet
    const isInTheMiddleOfSnippet = ref(false)
    const updateInTheMiddleOfSnippet = () => {
      // Logic to update the state of being in the middle of a snippet
      isInTheMiddleOfSnippet.value = !isInTheMiddleOfSnippet.value
    }

    // UI control states
    const isMetronomeEnabled = ref(false)
    const fileUploaded = ref(false)
    const startMeasure = ref(1)
    const endMeasure = ref(1)
    const speed = ref(1)
    const totalMeasures = ref(null)
    const selectedFile = ref('')
    const parts = ref([])
    const selectedPart = ref(null)

    // Data storage for music and performance
    const chartData = ref({
      labels: [],
      datasets: [
        {
          label: 'Noodid failist',
          borderColor: 'blue',
          backgroundColor: 'blue',
          pointRadius: 0,
          fill: false,
          stepped: 'before',
        },
        {
          label: 'Salvestatud noodid',
          borderColor: 'red',
          backgroundColor: 'red',
          pointRadius: 3,
          fill: false,
          stepped: 'before',
        },
      ],
    })

    // Additional state variables
    const timeSignatureInfo = ref([])
    const tempoInfo = ref([])
    const measureInfo = ref(null)
    const musicXmlNoteInfo = ref(null)
    const startTime = ref(null)
    const duration = ref(null)

    // Use metronome logic
    const { buildMetronome, startMetronome, stopMetronome } = useMetronome(
      timeSignatureInfo,
      tempoInfo,
      speed,
      measureInfo,
      isMetronomeEnabled,
    )

    // Use note playback logic (play first note)
    const { isNoteBeingPlayed, playNote } = useNotePlayback()

    // Use recording logic (record + analyze audio)
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
      startMeasure,
      endMeasure,
      speed,
      chartData,
      musicXmlNoteInfo,
      measureInfo,
      timeSignatureInfo,
      tempoInfo,
      selectedPart,
      buildMetronome,
      startMetronome,
      stopMetronome,
      isMetronomeEnabled,
      setStartTime: (v) => (startTime.value = v),
      setDuration: (v) => (duration.value = v),
      setError: (e) => (errorMessage.value = e),
    })

    // Reset chart data to empty
    const resetGraphData = () => {
      chartData.value.labels = []
      chartData.value.datasets[0].data = null
      chartData.value.datasets[1].data = null
    }

    // Fetch measure info, tempo info, time signatures and notes
    const fetchInfo = async () => {
      resetGraphData()
      try {
        const response = await getMeasureInfo(selectedPart.value)
        measureInfo.value = response.measure_info
        const lastMeasure = measureInfo.value[measureInfo.value.length - 1].measure
        endMeasure.value = lastMeasure
        totalMeasures.value = lastMeasure
      } catch (error) {
        errorMessage.value = error.message
      }
      try {
        const response = await getTimeSignatureInfo(selectedPart.value)
        timeSignatureInfo.value = response.time_signature_info
      } catch (error) {
        errorMessage.value = error.message
      }
      try {
        const response = await getTempoInfo()
        tempoInfo.value = response.tempo_info
      } catch (error) {
        errorMessage.value = error.message
      }
      fetchNotes()
    }

    // Fetch MusicXML notes for selected measures
    const fetchNotes = async () => {
      try {
        const response = await getMusicXmlNoteInfo(
          startMeasure.value,
          endMeasure.value,
          selectedPart.value,
        )
        musicXmlNoteInfo.value = response.note_info
      } catch (error) {
        errorMessage.value = error.message
      }
    }

    // Handle file upload result
    const handleFileUploaded = async (success) => {
      fileUploaded.value = success
      resetGraphData()
      if (!success) {
        musicXmlNoteInfo.value = null
        errorMessage.value = 'Vali MusicXML-fail!'
        return
      }
      startMeasure.value = 1
      try {
        const response = await getPartNames()
        parts.value = response.parts
        selectedPart.value = null
      } catch (error) {
        errorMessage.value = error.message
      }
    }

    // Clear errors when clicking anywhere
    const clearError = () => {
      errorMessage.value = null
    }

    // Setup window event listeners
    onMounted(() => {
      window.addEventListener('click', clearError)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('click', clearError)
    })

    // Refetch notes when measure selection changes
    watch([startMeasure, endMeasure], () => {
      fetchNotes()
    })

    // Return everything to template
    return {
      applicationQuitted,
      stopServers,
      selectedFile,
      fileUploaded,
      handleFileUploaded,
      parts,
      selectedPart,
      fetchInfo,
      startMeasure,
      endMeasure,
      speed,
      totalMeasures,
      isMetronomeEnabled,
      playNote,
      playSnippet,
      isPlayingSnippet,
      updateInTheMiddleOfSnippet,
      isInTheMiddleOfSnippet,
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
      musicXmlNoteInfo,
      timeSignatureInfo,
      tempoInfo,
      measureInfo,
      startTime,
      duration,
    }
  },
}
</script>

<style scoped></style>
