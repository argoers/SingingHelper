<template>
  <div class="chart-container">
    <canvas ref="chartCanvas"></canvas>
  </div>
</template>

<script>
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
import { ref, onMounted, watch } from "vue";

ChartJS.register(Title, Tooltip, Legend, LineController, LineElement, PointElement, LinearScale, CategoryScale);

export default {
  props: {
    chartData: {
      type: Object,
      required: true
    },
    isRecordingCancelled: Boolean
  },
  setup(props) {
    const chartCanvas = ref(null);
    let chartInstance = null;

    // ✅ Function to compute min & max from `chartData`
    const computeMinMaxPitch = () => {
      if (!props.chartData || !props.chartData.datasets.length) return { min: 50, max: 80 }; // Default range

      const allPitches = props.chartData.datasets
        .flatMap(dataset => dataset.data)
        .filter(value => value !== null); // Remove null values

      if (!allPitches.length) return { min: 50, max: 80 }; // If no valid data, use default

      return {
        min: Math.min(...allPitches) - 1, // ✅ Set min slightly lower for padding
        max: Math.max(...allPitches) + 1, // ✅ Set max slightly higher for padding
      };
    };
    const { min, max } = computeMinMaxPitch(); // ✅ Get dynamic Y-axis range

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        title: {
          display: true,
          text: ""
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,   // ✅ Show all bar labels
            stepSize: 1,
            maxRotation: 0,    // ✅ Keep them horizontal
            minRotation: 0,
            callback: function (value, index) {
              return props.chartData.labels[index] ? props.chartData.labels[index] : null;
            }
          },
        },
        y: {
          min: min,
          max: max,
          ticks: {
            autoSkip: false, // ✅ Show all Y ticks
            stepSize: 1,
            callback: function (value) {
              return midiToNote(value);
            }
          },
        },
      },
    };

    const createChart = () => {
      if (chartInstance) {
        chartInstance.destroy(); // Destroy previous instance to prevent memory leaks
      }
      
      if (!props.chartData || !props.chartData.labels.length || props.isRecordingCancelled) return;

      chartInstance = new ChartJS(chartCanvas.value, {
        type: "line",
        data: props.chartData,
        options: chartOptions
      });
    };

    const midiToNote = (midi) => {
      if (midi === null || midi < 0) return "";
      const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      const octave = Math.floor(midi / 12) - 1;
      const note = noteNames[midi % 12];
      return `${note}${octave}`;
    };

    onMounted(() => {
      createChart();
    });

    watch(() => props.chartData, () => {
      createChart();
    }, { deep: true });

    return { chartCanvas };
  }
};
</script>

<style scoped>
.chart-container {
  width: 100%;
}

canvas {
  width: 100%;
  height: 400px;
}
</style>