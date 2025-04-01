<template>
  <button v-if="!applicationQuitted" @click="stopServers" class="button">Sulge rakendus</button>
  <p v-if="applicationQuitted">Sulge aken</p>
  <div v-if="!applicationQuitted" class="container">
    <h2>MusicXML faili ja laulmise võrdlus</h2>

    <div class="card">
      <FileUpload
        @file-uploaded="handleFileUploaded"
        :isRecordingProcessActive="isInCountdown || isRecording || isProcessingAudio"
      />
      <p v-if="selectedFile">
        Fail: <b>{{ selectedFile }}</b>
      </p>
      <div v-if="fileUploaded">
        <label for="partSelect">Partii:</label>
        <select id="partSelect" v-model="selectedPart" @change="fetchNotes">
          <option v-for="part in parts" :key="part" :value="part">{{ part }}</option>
        </select>
      </div>
    </div>

    <div class="card" v-show="selectedPart">
      <MeasureAndSpeedSelection
        :selectedPart="selectedPart"
        :disabled="isInCountdown || isRecording || isProcessingAudio"
        :totalMeasures="totalMeasures"
        v-model:startMeasure="startMeasure"
        v-model:endMeasure="endMeasure"
        v-model:speed="speed"
      />

      <label v-if="selectedPart">
        <input
          type="checkbox"
          v-model="isMetronomeEnabled"
          :disabled="isInCountdown || isRecording || isProcessingAudio"
        />
        Metronoom laulmise ajal
      </label>
    </div>

    <div class="card" v-show="selectedPart">
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
        v-if="musicXmlNoteInfo"
        :musicXmlNoteInfo="musicXmlNoteInfo"
        :isRecording="isRecording"
        :speed="speed"
        :startMeasure="startMeasure"
        :endMeasure="endMeasure"
        :tempoInfo="tempoInfo"
        :timeSignatureInfo="timeSignatureInfo"
      />
    </div>
    <NoteReplay
      v-if="chartData.datasets[1].data && chartData.datasets[0].data"
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

    <ChartDisplay
      v-if="chartData.labels.length > 0"
      :chart-data="chartData"
      :isRecordingCancelled="isRecordingCancelled"
      :showChart="showChart"
      :isRecording="isInCountdown || isRecording || isProcessingAudio"
      @toggle-chart="showChart = !showChart"
    />
  </div>
</template>

<script lang="js">
import { ref } from 'vue'
import FileUpload from './components/FileUpload.vue'
import ChartDisplay from './components/ChartDisplay.vue'
import NoteVisualization from './components/NoteVisualization.vue'
import NoteReplay from './components/NoteReplay.vue'
import { useMetronome } from '@/composables/useMetronome'
import { useRecording } from '@/composables/useRecording'
import { useNotePlayback } from '@/composables/useNotePlayback'
import MeasureAndSpeedSelection from './components/MeasureAndSpeedSelection.vue'
import RecordingControls from './components/RecordingControls.vue'
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
    const startMeasure = ref(1)
    const endMeasure = ref(1)
    const speed = ref(1)
    const totalMeasures = ref(null)
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
    const timeSignatureInfo = ref([])
    const tempoInfo = ref([])
    const measureInfo = ref(null)
    const musicXmlNoteInfo = ref(null)
    const startTime = ref(null)
    const duration = ref(null)

    const { buildMetronome, startMetronome, stopMetronome } = useMetronome(
      timeSignatureInfo,
      tempoInfo,
      speed,
      measureInfo,
      isMetronomeEnabled,
    )

    const { isNoteBeingPlayed, playFirstNote } = useNotePlayback(musicXmlNoteInfo)

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

    const fetchNotes = async () => {
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
        const response = await getTempoInfo(selectedPart.value)
        tempoInfo.value = response.tempo_info
      } catch (error) {
        errorMessage.value = error.message
      }
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

    const handleFileUploaded = async (success) => {
      fileUploaded.value = success
      if (!success) {
        errorMessage.value = 'Vali MusicXML fail!'
        chartData.value.labels = {}
        chartData.value.datasets[0].data = null
        chartData.value.datasets[1].data = null
        return
      }
      chartData.value.labels = {}
      chartData.value.datasets[0].data = null
      chartData.value.datasets[1].data = null
      startMeasure.value = 1
      try {
        const response = await getPartNames()
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
      startMeasure,
      endMeasure,
      speed,
      totalMeasures,
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
