<template>
  <div class="container">
    <h2>🎼 Compare MIDI & Singing</h2>

    <div class="upload-section">
      <FileUpload @file-uploaded="handleFileUploaded" />
      <p v-if="selectedFile">📂 Selected file: <strong>{{ selectedFile }}</strong></p>
    </div>

    <div class="bar-selection">
      <label>Start Bar:</label>
      <input type="number" v-model="startBar" min="1" />

      <label>End Bar:</label>
      <input type="number" v-model="endBar" min="1" />
    </div>

    <button @click="startComparison" :disabled="isLoading || !fileUploaded">
      🎤 Start Recording
    </button>
    <button @click="cancelRecordingProcess" v-if="isLoading">❌ Cancel Recording</button>


    <p v-if="isLoading">⏳ Processing... Please wait!</p>
    <p v-if="errorMessage" class="error">❌ {{ errorMessage }}</p>

    <ChartDisplay v-if="chartData.labels.length" :chart-data="chartData" :isRecordingCancelled="isRecordingCancelled" />
  </div>
</template>

<script>
import { ref } from "vue";
import FileUpload from "./components/FileUpload.vue";
import BarSelection from "./components/BarSelection.vue";
import ChartDisplay from "./components/ChartDisplay.vue";
import { compareSinging, cancelRecording } from "./services/api";

export default {
  components: {
    FileUpload,
    BarSelection,
    ChartDisplay,
  },
  setup() {
    const startBar = ref(1);
    const endBar = ref(1);
    const isLoading = ref(false);
    const isRecordingCancelled = ref(false);
    const errorMessage = ref("");
    const fileUploaded = ref(false);
    const chartData = ref({ labels: [], datasets: [] });
    const selectedFile = ref('');
    let requestSession = 0; // ✅ Track current request session to prevent old updates

    const handleFileUploaded = (success) => {
      fileUploaded.value = success;
    };

    const startComparison = async () => {
      isLoading.value = true;
      isRecordingCancelled.value = false;
      errorMessage.value = "";
  
      const currentSession = ++requestSession;
      console.log(currentSession);

      try {
        const data = await compareSinging(startBar.value, endBar.value);
        if (currentSession === requestSession && !isRecordingCancelled.value) {
          chartData.value = data;
        }
      } catch (error) {
        errorMessage.value = error.message;
      } finally {
        if (currentSession === requestSession) {
          isLoading.value = false;
        }
      }
    };

    const cancelRecordingProcess = async () => {
      const canceled = await cancelRecording();
      if (canceled) {
        isRecordingCancelled.value = true;
        isLoading.value = false;
        chartData.value = { labels: [], datasets: [] };
        errorMessage.value = "Recording canceled!";
      }
    };

    return { startBar, endBar, isLoading, errorMessage, fileUploaded, chartData, handleFileUploaded, startComparison, cancelRecordingProcess, selectedFile, isRecordingCancelled };
  },
};
</script>

<style scoped>
.container {
  text-align: center;
  max-width: 1400px;
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
  background-color: #4CAF50;
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