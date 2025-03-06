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

    <button @click="startComparison" :disabled="countdown > 0" v-if="!isLoading && fileUploaded">
      🎤 {{ countdown > 0 ? `Starting in ${countdown}...` : "Start Recording" }}
    </button>
    <button @click="cancelRecordingProcess" v-if="isLoading">❌ Cancel Recording</button>
    <button @click="playFirstNote" v-if="!isLoading && fileUploaded && countdown == 0">Play First Note</button>


    <p v-if="isLoading">🎤 Sing now!</p>
    <p v-if="errorMessage" class="error">❌ {{ errorMessage }}</p>

    <ChartDisplay v-if="chartData.labels.length" :chart-data="chartData" :isRecordingCancelled="isRecordingCancelled" />
  </div>
</template>

<script>
import { ref } from "vue";
import FileUpload from "./components/FileUpload.vue";
import BarSelection from "./components/BarSelection.vue";
import ChartDisplay from "./components/ChartDisplay.vue";
import { compareSinging, cancelRecording, getTempo } from "./services/api";
import metronomeSound from "@/assets/metronome.mp3";

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
    const countdown = ref(0);
    const tempo = ref(60); // Default tempo (BPM)

    let requestSession = 0; // ✅ Track current request session to prevent old updates
    let metronomeInterval = null;
    let metronomeAudio = new Audio(metronomeSound); // ✅ Load metronome sound
    metronomeAudio.load();

    const handleFileUploaded = async (success) => {
      fileUploaded.value = success;
      try {
        const response = await getTempo(); // ✅ Fetch tempo from backend
        tempo.value = response.tempo || 120; // ✅ Update tempo, fallback to 120 BPM
      } catch (error) {
        errorMessage.value = "Failed to fetch tempo.";
      }
    };

    const playClickSound = () => {
      metronomeAudio.currentTime = 0;
      metronomeAudio.play();
    };

    const playMetronome = () => {
      stopMetronome();
      const interval = (60 / tempo.value) * 1000; // ✅ Convert BPM to milliseconds
      metronomeInterval = setInterval(playClickSound, interval); // Adjust for tempo
    };

    const stopMetronome = () => {
      if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
      }
    };

    const playFirstNote = async () => {
      const audioCtx = new window.AudioContext();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.frequency.setValueAtTime(chartData.value.datasets[0].data[0], audioCtx.currentTime);
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      //gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2); // Stop after 100ms */
    }

    const startComparison = async () => {

      isRecordingCancelled.value = false;
      errorMessage.value = "";

      countdown.value = 3; // ✅ Start countdown from 3
      playMetronome();

      // ✅ Wait for countdown to finish
      while (countdown.value > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 sec
        countdown.value--;
      }
      isLoading.value = true;
      const currentSession = ++requestSession;


      try {
        const data = await compareSinging(startBar.value, endBar.value);
        if (currentSession === requestSession && !isRecordingCancelled.value) {
          chartData.value = data;
        }
      } catch (error) {
        errorMessage.value = error.message;
      } finally {
        if (currentSession === requestSession) {
          stopMetronome();
          isLoading.value = false;
        }
      }
    };

    const cancelRecordingProcess = async () => {
      stopMetronome();
      const canceled = await cancelRecording();
      if (canceled) {
        isRecordingCancelled.value = true;
        isLoading.value = false;
        chartData.value = { labels: [], datasets: [] };
        errorMessage.value = "Recording canceled!";
      }
    };

    return { startBar, endBar, isLoading, errorMessage, fileUploaded, chartData, handleFileUploaded, startComparison, cancelRecordingProcess, selectedFile, isRecordingCancelled, countdown, playFirstNote };
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