<template>
  <div class="container">
    <h2>🎼 Compare MIDI & Singing</h2>

    <div class="upload-section">
      <FileUpload @file-uploaded="handleFileUploaded" :isLoading="isLoading" :countdown="countdown" />
      <p v-if="selectedFile">📂 Selected file: <b>{{ selectedFile }}</b></p>
    </div>

    <div v-if="fileUploaded" class="bar-selection">
      <label>Start Bar:</label>
      <input type="number" v-model="startBar" />

      <label>End Bar:</label>
      <input type="number" v-model="endBar" />

      <div v-if="tempo !== null">
        <label>Tempo:</label>
        <input type="number" v-model="tempo" />
      </div>
    </div>

    <button @click="startRecordingAudio" :disabled="countdown > 0" v-if="!isLoading && fileUploaded">
      🎤 {{ countdown > 0 ? `Starting in ${countdown}...` : "Start Recording" }}
    </button>
    <button @click="cancelRecordingProcess" v-if="isLoading">❌ Cancel Recording</button>
    <button @click="playFirstNote" v-if="!isLoading && fileUploaded && countdown == 0">Play First Note</button>


    <p v-if="isLoading">{{ loadingMessage }}</p>
    <p v-if="errorMessage" class="error">❌ {{ errorMessage }}</p>

    <ChartDisplay v-if="chartData.labels.length" :chart-data="chartData" :isRecordingCancelled="isRecordingCancelled" />
  </div>
</template>

<script>
import { ref, watch } from "vue";
import FileUpload from "./components/FileUpload.vue";
import BarSelection from "./components/BarSelection.vue";
import ChartDisplay from "./components/ChartDisplay.vue";
import { recordAudio, cancelRecording, getTempo, getMidiFileInfo, extractPitchesFromAudio, getBarTotal } from "./services/api";
import metronomeSound from "@/assets/metronome.mp3";

export default {
  components: {
    FileUpload,
    BarSelection,
    ChartDisplay,
  },
  setup() {
    const loadingMessage = ref('🎤 Sing now!');
    const startBar = ref(1);
    const endBar = ref(1);
    const isLoading = ref(false);
    const isRecordingCancelled = ref(false);
    const errorMessage = ref("");
    const fileUploaded = ref(false);
    const chartData = ref({
      labels: [], datasets: [
        {
          label: "MIDI Notes",
          borderColor: "blue",
          backgroundColor: "blue",
          pointRadius: 0,
          fill: false,
          stepped: "before",
          //spanGaps: true,
        },
        {
          label: "Sung Notes",
          borderColor: "red",
          backgroundColor: "red",
          pointRadius: 3,
          fill: false,
          stepped: "before",
          spanGaps: true,
        }
      ]
    });
    const selectedFile = ref('');
    const countdown = ref(0);
    const tempo = ref(null); // Default tempo (BPM)
    const totalBars = ref(null);
    const defaultTempo = ref(null);

    let requestSession = 0; // ✅ Track current request session to prevent old updates
    let metronomeInterval = null;
    let metronomeAudio = new Audio(metronomeSound); // ✅ Load metronome sound
    metronomeAudio.load();

    const resetData = () => {
      chartData.value.labels = {};
      chartData.value.datasets[0].data = {};
      chartData.value.datasets[1].data = null;
    }

    const handleFileUploaded = async (success) => {
      fileUploaded.value = success;
      if (!success) {
        errorMessage.value = "Select a MIDI file!";
        resetData();
        return;
      } else {
        errorMessage.value = "";
      }

      try {
        const response = await getTempo(); // ✅ Fetch tempo from backend
        tempo.value = Math.round(response.tempo)
        defaultTempo.value = Math.round(response.tempo);
      } catch (error) {
        errorMessage.value = "Failed to fetch tempo.";
      }

      try {
        const response = await getBarTotal(); // ✅ Fetch tempo from backend
        endBar.value = response.bar_total
        totalBars.value = response.bar_total
      } catch (error) {
        errorMessage.value = "Failed to fetch bars.";
      }


      try {
        const response = await getMidiFileInfo(startBar.value, endBar.value); // ✅ Fetch tempo from backend
        chartData.value.datasets[0].data = response.midiNotes;
        chartData.value.labels = response.labels;
      } catch (error) {
        errorMessage.value = "Failed to fetch MIDI notes.";
      }
    };

    const playClickSound = (loud) => {
      const firstBeatVolume = loud ? 1 : 0.1
      const allBeatVolumeCoef = countdown.value > 1 ? 1 : 0.1
      metronomeAudio.currentTime = 0;
      metronomeAudio.volume = firstBeatVolume * allBeatVolumeCoef;
      metronomeAudio.play();
    };

    const playMetronome = (loud) => {
      stopMetronome();
      playClickSound(loud);
      const beatsPerBar = 4
      let beatCount = 0;
      const interval = (60 / tempo.value) * 1000; // ✅ Convert BPM to milliseconds
      metronomeInterval = setInterval(() => {
        beatCount = (beatCount + 1) % beatsPerBar;
        playClickSound(beatCount === 0); // Strong beat on 1, weaker on others
      }, interval);
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

      const firstNoteFrequency = chartData.value.datasets[0].data.filter(value => value)[0];
      oscillator.frequency.setValueAtTime(firstNoteFrequency * 4, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      //gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2); // Stop after 100ms */
    }

    const startRecordingAudio = async () => {

      isRecordingCancelled.value = false;
      errorMessage.value = "";
      const currentSession = ++requestSession;
      countdown.value = 8; // ✅ Start countdown from 3
      playMetronome(true);
      chartData.value.datasets[1].data = null;
      // ✅ Wait for countdown to finish
      while (countdown.value > 0) {
        await new Promise(resolve => setTimeout(resolve, (60 / tempo.value) * 1000)); // Wait 1 sec
        countdown.value--;
      }

      isLoading.value = true;

      try {
        await recordAudio(startBar.value, endBar.value, tempo.value);
      } catch (error) {
        errorMessage.value = error.message;
      }

      stopMetronome();
      loadingMessage.value = "Processing audio"

      try {
        const data = await extractPitchesFromAudio(startBar.value, endBar.value);
        if (currentSession === requestSession && !isRecordingCancelled.value) {
          chartData.value.datasets[1].data = data.liveNotes;
        }
      } catch (error) {
        errorMessage.value = error.message;
      }

      if (currentSession === requestSession) {
        isLoading.value = false;
      }

      loadingMessage.value = '🎤 Sing now!'
    };

    const cancelRecordingProcess = async () => {
      stopMetronome();
      const canceled = await cancelRecording();
      if (canceled) {
        isRecordingCancelled.value = true;
        isLoading.value = false;
        errorMessage.value = "Recording canceled!";
      }
    };

    watch([startBar, endBar], async () => {
      if (startBar.value && endBar.value || endBar.value === 0 || startBar.value === 0) {
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
        } else {
          try {
            const response = await getMidiFileInfo(startBar.value, endBar.value); // ✅ Fetch tempo from backend
            chartData.value.datasets[0].data = response.midiNotes;
            chartData.value.datasets[1].data = null;
            chartData.value.labels = response.labels;
          } catch (error) {
            errorMessage.value = "Failed to fetch tempo.";
          }
        }
      }
    });

    watch(tempo, async () => {
      if (tempo.value && tempo.value < 0 || tempo.value === 0) {
        tempo.value = defaultTempo.value
      }
    });



    return { loadingMessage, startBar, endBar, isLoading, errorMessage, fileUploaded, chartData, handleFileUploaded, startRecordingAudio, cancelRecordingProcess, selectedFile, isRecordingCancelled, countdown, playFirstNote, tempo };
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