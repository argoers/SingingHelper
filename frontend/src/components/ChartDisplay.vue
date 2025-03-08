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
      const allPitches = props.chartData.datasets
        .flatMap(dataset => dataset.data)
        .filter(value => value !== null); // Remove null values
      if (!allPitches) return;
      chartOptions.scales.y.min = Math.floor(Math.min(...allPitches)) - 1;
      chartOptions.scales.y.max = Math.ceil(Math.max(...allPitches)) + 1;
    };

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
            autoSkip: false,
            stepSize: 1,
            maxRotation: 0,
            callback: function (value, index) {
              return props.chartData.labels[index] ? props.chartData.labels[index] : null;
            }
          },
        },
        y: {
          ticks: {
            autoSkip: false,
            stepSize: 1,
            callback: (value) => midiToNote(value)
          },
        },
      },
    };

    const createChart = () => {
      if (chartInstance) {
        chartInstance.destroy(); // Destroy previous instance to prevent memory leaks
      }

      if (!props.chartData || !props.chartData.labels.length || props.isRecordingCancelled) return;
      computeMinMaxPitch();
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
  height: 100%;
}

canvas {
  width: 100%;
  height: 100%;
}
</style>