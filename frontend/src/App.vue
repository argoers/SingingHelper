<template>
  <div class="container">
    <div>
      <h2>Select a Microphone</h2>

      <label for="micSelect">Microphone:</label>
      <select v-model="selectedDeviceId" id="micSelect">
        <option v-for="(device, index) in microphones" :key="device.deviceId" :value="device.deviceId">
          {{ device.label || `Microphone ${index + 1}` }}
        </option>
      </select>

      <button @click="getMicrophones">Refresh List</button>

      <p v-if="selectedDeviceId">Selected Microphone: {{ selectedMicLabel }}</p>
    </div>
    <h2>🎼 Compare MIDI & Singing</h2>

    <div class="upload-section">
      <FileUpload @file-uploaded="handleFileUploaded"
        :isRecordingProcessActive="isInCountdown || isRecording || isProcessingAudio" />
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

    <button @click="startRecordingAudio" :disabled="isInCountdown"
      v-if="!isRecording && !isProcessingAudio && fileUploaded">
      🎤 {{ countdown > 0 ? `Starting in ${countdown}...` : "Start Recording" }}
    </button>
    <button @click="cancelRecordingProcess" v-if="isRecording">❌ Cancel Recording</button>
    <button @click="playFirstNote" v-if="!isRecording && !isInCountdown && !isProcessingAudio && fileUploaded">Play
      First Note</button>

    <p v-if="isRecording">{{ loadingRecordingMessage }}</p>
    <p v-if="isProcessingAudio">{{ loadingProcessingMessage }}</p>
    <p v-if="errorMessage" class="error">❌ {{ errorMessage }}</p>
    <NoteVisualization v-if="midiNotes" :midiNotes="midiNotes" :isRecording="isRecording" :tempo="tempo"
      :startBar="startBar" :endBar="endBar" />
    <ChartDisplay v-if="chartData.labels.length" :chart-data="chartData" :isRecordingCancelled="isRecordingCancelled" />

  </div>
</template>

<script>
import { computed, onMounted, ref, watch } from "vue";
import FileUpload from "./components/FileUpload.vue";
import BarSelection from "./components/BarSelection.vue";
import ChartDisplay from "./components/ChartDisplay.vue";
import { getMidiNotes, recordAudio, getTempo, getMidiFileInfo, extractPitchesFromAudio, getBarTotal, getTimeSignature } from "./services/api";
import metronomeSound from "@/assets/metronome.mp3";
import NoteVisualization from "./components/NoteVisualization.vue";

export default {
  components: {
    FileUpload,
    BarSelection,
    ChartDisplay,
    NoteVisualization
  },
  setup() {
    const getMicrophones = async () => {
      try {
        // Request microphone permission
        //await navigator.mediaDevices.getUserMedia({ audio: true });

        // Get all media devices
        const devices = await navigator.mediaDevices.enumerateDevices();

        selectedDeviceId.value = devices[2].deviceId;
        // Filter only audio input devices (microphones)
        microphones.value = devices.filter(device => device.kind === "audioinput").slice(2);
      } catch (error) {
        console.error("Error accessing microphones:", error);
      }
    }

    onMounted(() => getMicrophones())
    const microphones = ref([]);
    const selectedDeviceId = ref(null);
    const selectedMicLabel = computed(() => {
      const mic = microphones.value.find(device => device.deviceId === selectedDeviceId.value);
      return mic ? mic.label || `Microphone` : "None";
    });

    const loadingRecordingMessage = ref('🎤 Sing now!');
    const loadingProcessingMessage = ref("Processing audio");
    const startBar = ref(1);
    const endBar = ref(1);
    const isInCountdown = ref(false);
    const isRecording = ref(false);
    const isProcessingAudio = ref(false);
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
    const midiNotes = ref(null);
    const timeSignature = ref(null);

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
        const response = await getTimeSignature(); // ✅ Fetch tempo from backend
        timeSignature.value = [response.numerator, response.denominator];
      } catch (error) {
        errorMessage.value = "Failed to fetch MIDI notes.";
      }

      try {
        const response = await getTempo(); // ✅ Fetch tempo from backend
        let correctTempo = timeSignature.value[1] / 4 * response.tempo
        tempo.value = correctTempo
        defaultTempo.value = correctTempo;
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
        const response = await getMidiNotes(startBar.value, endBar.value); // ✅ Fetch tempo from backend
        midiNotes.value = response.midiNotes;
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
      const beatsPerBar = timeSignature.value[0]
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
      oscillator.frequency.setValueAtTime(440 * Math.pow(2, (firstNoteFrequency - 69) / 12), audioCtx.currentTime);
      gainNode.gain.setValueAtTime(1, audioCtx.currentTime);
      //gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 2); // Stop after 100ms */
    }

    const startRecordingAudio = async () => {
      const currentSession = ++requestSession;

      isRecordingCancelled.value = false;
      errorMessage.value = "";

      isInCountdown.value = true;
      countdown.value = timeSignature.value[0] * 2; // ✅ Start countdown from 3

      playMetronome(true);

      while (countdown.value > 0) {
        await new Promise(resolve => setTimeout(resolve, (60 / tempo.value) * 1000)); // Wait 1 sec
        countdown.value--;
      }

      isInCountdown.value = false;
      isRecording.value = true;

      try {
        await recordAudio(startBar.value, endBar.value, tempo.value, selectedMicLabel.value ?? 'default');
      } catch (error) {
        errorMessage.value = error.message;
      }
      if (currentSession !== requestSession || isRecordingCancelled.value) return;

      isRecording.value = false;
      stopMetronome();

      isProcessingAudio.value = true;

      try {
        const data = await extractPitchesFromAudio(startBar.value, endBar.value);
        if (currentSession === requestSession && !isRecordingCancelled.value) {
          chartData.value.datasets[1].data = data.liveNotes;
          console.log(data.liveNotes)
        }
      } catch (error) {
        errorMessage.value = error.message;
      }

      if (currentSession === requestSession) {
        isProcessingAudio.value = false;
        try {
          console.log(chartData.value.datasets[1].data)
          console.log(chartData.value.datasets[1].data.length)
          const data = await getMidiFileInfo(startBar.value, endBar.value, chartData.value.datasets[1].data.length)
          //console.log(data)
          chartData.value.datasets[0].data = data.midiNotesPoints;
          chartData.value.labels = data.labels;
          //console.log(data.labels)
        } catch (error) {
          errorMessage.value = error.message;
        }
      }
    };

    const cancelRecordingProcess = async () => {
      stopMetronome();

      isRecordingCancelled.value = true;
      isRecording.value = false;
      isProcessingAudio.value = false;
      errorMessage.value = "Recording canceled!";
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
            //const response = await getMidiFileInfo(startBar.value, endBar.value, ); // ✅ Fetch tempo from backend
            //chartData.value.datasets[0].data = response.midiNotesPoints;
            //chartData.value.datasets[1].data = null;
            //chartData.value.labels = response.labels;
            //midiNotes.value = response.midiNotes;
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

    return { selectedMicLabel, selectedDeviceId, getMicrophones, microphones, isInCountdown, isProcessingAudio, isRecording, midiNotes, loadingRecordingMessage, loadingProcessingMessage, startBar, endBar, errorMessage, fileUploaded, chartData, handleFileUploaded, startRecordingAudio, cancelRecordingProcess, selectedFile, isRecordingCancelled, countdown, playFirstNote, tempo };
  },
};
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