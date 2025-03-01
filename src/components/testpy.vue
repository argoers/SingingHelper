<script>
import { defineComponent, ref } from "vue";
import { LineChart } from "vue-chart-3";
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale
} from "chart.js";

// ✅ Register required Chart.js components
ChartJS.register(Title, Tooltip, Legend, LineController, LineElement, PointElement, LinearScale, CategoryScale);

// ✅ Function to Convert MIDI Pitch to Note Name
const midiToNote = (midi) => {
  if (midi === null || midi < 0) return "";
  const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const octave = Math.floor(midi / 12) - 1;
  const note = noteNames[midi % 12];
  return `${note}${octave}`;
};

export default defineComponent({
  components: {
    LineChart,
  },
  setup() {
    const chartData = ref({
      labels: [], // Time labels
      datasets: [
        {
          label: "MIDI Notes",
          data: [], // MIDI note pitches
          borderColor: "blue",
          backgroundColor: "blue",
          pointRadius: 0, // Hide extra dots
          spanGaps: true, // ✅ Connect horizontal lines
          fill: false,
          stepped: "before", // ✅ Display MIDI as horizontal steps
        },
        {
          label: "Sung Notes",
          data: [], // Sung pitches
          borderColor: "red",
          backgroundColor: "red",
          pointRadius: 3,
          fill: false,
          spanGaps: true, // ✅ Connect horizontal lines
          stepped: "before", // ✅ Display MIDI as horizontal steps
        },
      ],
    });

    const chartOptions = ref({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
    });

    const isLoading = ref(false);
    const errorMessage = ref("");
    const startBar = ref(1);
    const endBar = ref(1);

    // ✅ Fetch MIDI and singing pitch data
    const compareSinging = async () => {
      isLoading.value = true;
      errorMessage.value = "";

      try {
        console.log(`🔄 Recording for bars ${startBar.value} to ${endBar.value}...`);

        const response = await fetch("http://127.0.0.1:5000/run-script", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ start_bar: startBar.value, end_bar: endBar.value }), 
        });
        const data = await response.json();

        if (response.ok) {
          console.log("✅ Data received:", data);

          if (!data.midi_notes || !data.live_pitches) {
            throw new Error("Missing data in API response");
          }

          const midiNotes = data.midi_notes.map((note) => ({
            start: note[0], 
            end: note[1], 
            pitch: note[2]
          }));

          const liveTimes = data.live_pitches.map((pitch) => pitch[0]);  // Live timestamps
          const livePitches = data.live_pitches.map((pitch) => pitch[1]);  // Live detected pitches
          
          // ✅ Step 1: Create a common time axis (Ensure correct min/max time)
          const allTimes = [
            ...midiNotes.map(n => n.start), 
            ...midiNotes.map(n => n.end), 
            ...liveTimes
          ];

          if (allTimes.length === 0) {
            throw new Error("No valid time data available");
          }

          const minTime = Math.min(...allTimes);
          const maxTime = Math.max(...allTimes);
          
          let numPoints = 100;  // Increase for smoother chart
          const numBars = endBar.value - startBar.value + 1;
          while (numPoints % numBars != 0) {
            numPoints += 1;
          }
          const timeStep = (maxTime - minTime) / numPoints;
          const timeAxis = Array.from({ length: numPoints }, (_, i) => minTime + i * timeStep);

          // ✅ Step 2: Extend MIDI notes over their duration
          const midiMapped = timeAxis.map((t) => {
            const activeNote = midiNotes.find(note => note.start <= t && t <= note.end);
            return activeNote ? activeNote.pitch : null;
          });

          // ✅ Step 3: Align live singing data
          const liveMapped = timeAxis.map((t) => {
            const closestIndex = liveTimes.findIndex((lt) => Math.abs(lt - t) < timeStep / 2);
            return closestIndex !== -1 ? livePitches[closestIndex] : null;
          });

          // ✅ Step 4: Remove empty/null datasets if all values are null
          if (midiMapped.every(v => v === null)) {
            console.warn("⚠️ MIDI data is empty after mapping.");
          }
          if (liveMapped.every(v => v === null)) {
            console.warn("⚠️ Live pitch data is empty after mapping.");
          }

          console.log("📊 Time Axis:", timeAxis);
          console.log("🎼 Mapped MIDI Pitches:", midiMapped);
          console.log("🎤 Mapped Live Pitches:", liveMapped);

          // ✅ Step 5: Update chart data
          const barStep = numBars / numPoints; // Distribute points across bars
          const barAxis = Array.from({ length: numPoints }, (_, i) => startBar.value + i * barStep);
          console.log(barAxis)
          chartData.value.labels = barAxis.map((b, i) => (i % (numPoints/numBars) === 0 ? `Bar ${Math.round(b)}` : ""));

          console.log(chartData.value.labels)
          chartData.value.datasets[0].data = midiMapped;
          chartData.value.datasets[1].data = liveMapped;
        } else {
          console.error("❌ API Error:", data.error);
          errorMessage.value = `Error: ${data.error}`;
        }
      } catch (error) {
        console.error("❌ Request failed:", error);
        errorMessage.value = "Failed to connect to backend!";
      } finally {
        isLoading.value = false;
      }
    };

    return { chartData, chartOptions, compareSinging, isLoading, errorMessage, startBar, endBar };
  },
});
</script>

<template>
  <div class="container">
    <h2>🎼 Compare MIDI & Singing in Same Bars</h2>

    <label>Start Bar:</label>
    <input type="number" v-model="startBar" min="1" />

    <label>End Bar:</label>
    <input type="number" v-model="endBar" min="1" />

    <button @click="compareSinging" :disabled="isLoading"> 🎤 Start Recording </button>

    <p v-if="isLoading">⏳ Recording... Please sing now!</p>
    <p v-if="errorMessage" class="error">❌ {{ errorMessage }}</p>

    <LineChart v-if="chartData.labels.length" :chart-data="chartData" :chart-options="chartOptions" />
  </div>
</template>

<style scoped>
.container {
  text-align: center;
  margin-top: 20px;
}
button {
  background-color: #4CAF50;
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
  margin-bottom: 10px;
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
