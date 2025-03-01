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
    const duration = ref(5);  // 🔹 CHANGED: Default recording duration is now 5 seconds, user can modify

    // ✅ Fetch MIDI and singing pitch data
    const compareSinging = async () => {
      isLoading.value = true;
      errorMessage.value = "";

      try {
        console.log(`🔄 Recording for ${duration.value} seconds...`);  // 🔹 CHANGED: Log user-defined duration

        const response = await fetch("http://127.0.0.1:5000/run-script", {
          method: "POST", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ duration: duration.value }), 
        });
        const data = await response.json();

        if (response.ok) {
          console.log("✅ Data received:", data);

          const midiNotes = data.midi_notes.map((note) => ({
            start: note[0], 
            end: note[1], 
            pitch: note[2]
          }));

          const liveTimes = data.live_pitches.map((pitch) => pitch[0]);  // Live timestamps
          const livePitches = data.live_pitches.map((pitch) => pitch[1]);  // Live detected pitches
          console.log(livePitches)
          // Step 1: Create a common time axis
          const minTime = Math.min(...midiNotes.map(n => n.start), ...liveTimes);
          const maxTime = Math.max(...midiNotes.map(n => n.end), ...liveTimes);
          
          const numPoints = 100;  // Increase for smoother chart
          const timeStep = (maxTime - minTime) / numPoints;
          const allTimes = Array.from({ length: numPoints }, (_, i) => minTime + i * timeStep);

          // Step 2: Extend MIDI notes over their duration
          const midiMapped = allTimes.map((t) => {
            const activeNote = midiNotes.find(note => note.start <= t && t <= note.end);
            return activeNote ? activeNote.pitch : null;  // Keep note constant over duration
          });

          // Step 3: Align live singing data
          const liveMapped = allTimes.map((t) => {
            const closestIndex = liveTimes.findIndex((lt) => Math.abs(lt - t) < timeStep / 2);
            return closestIndex !== -1 ? livePitches[closestIndex] : null;
          });

          console.log("Mapped Time Labels:", allTimes.slice(0, 10));
          console.log("Mapped MIDI Pitches (Extended):", midiMapped.slice(0, 10));
          console.log("Mapped Live Pitches:", liveMapped.slice(0, 10));

          // Step 4: Update chart data
          chartData.value.labels = allTimes.map((t) => `${t.toFixed(2)}s`);
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

    return { chartData, chartOptions, compareSinging, isLoading, errorMessage, duration };
  },
});
</script>

<template>
  <div class="container">
    <h2>Comparison Chart: MIDI vs Sung Notes</h2>
    <label>🎤 Recording Duration (seconds):</label>  
    <input type="number" v-model="duration" min="1" max="30" />  <!-- 🔹 CHANGED: Allow user to input duration -->
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
