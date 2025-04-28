<template>
  <!-- Main card container for the chart -->
  <div class="card">
    <!-- Section title -->
    <h2 class="section-title">Laulmise graafik takti kaupa</h2>

    <!-- Button to toggle chart visibility -->
    <div class="card">
      <button :disabled="isRecording" @click="$emit('toggle-chart')">
        {{ showChart ? 'Peida' : 'Näita' }}
      </button>
    </div>

    <!-- Chart container, only visible if showChart is true -->
    <div class="chart-container" v-show="showChart">
      <!-- Canvas element where the chart is drawn -->
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script lang="ts">
// Import necessary chart.js components
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
} from 'chart.js'

// Import Vue features for reactivity and lifecycle
import { ref, watch, onMounted } from 'vue'

// Register chart.js components
ChartJS.register(
  Title,
  Tooltip,
  Legend,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
)

export default {
  // Define component props passed from the parent
  props: {
    chartData: Object, // Data for the chart (labels and datasets)
    isRecordingCancelled: Boolean, // Flag for whether recording was cancelled
    showChart: Boolean, // Flag for whether the chart is visible
    isRecording: Boolean, // Flag for whether recording is ongoing
  },
  // Define events the component can emit
  emits: ['toggle-chart'],

  setup(props) {
    // Reference to the canvas element for drawing the chart
    const chartCanvas = ref(null)

    // Variable to store the chart instance
    let chartInstance = null

    // Function to compute min and max pitch values for y-axis scaling
    const computeMinMaxPitch = () => {
      const allPitches = props.chartData.datasets
        .flatMap((dataset) => dataset.data)
        .filter((value) => value !== null)

      if (!allPitches) return

      // Set y-axis min and max values based on data
      chartOptions.scales.y.min = Math.floor(Math.min(...allPitches)) - 2
      chartOptions.scales.y.max = Math.ceil(Math.max(...allPitches)) + 2

      // Adjust canvas height based on pitch range
      chartCanvas.value.height = Math.min(
        1000,
        (chartOptions.scales.y.max - chartOptions.scales.y.min) * 30,
      )
    }

    // Chart options (customization for axes, plugins, etc.)
    const chartOptions = {
      responsive: true, // Make chart responsive to resizing
      maintainAspectRatio: false, // Do not maintain aspect ratio
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 18 },
          },
        },
        title: {
          display: true,
          text: '', // No title for now
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            stepSize: 1,
            maxRotation: 0,
            font: { size: 18 },
            callback: (value, index) =>
              props.chartData.labels[index] ? props.chartData.labels[index] : null, // Set x-axis labels
          },
        },
        y: {
          ticks: {
            autoSkip: false,
            stepSize: 1,
            font: { size: 18 },
            callback: (value) => midiPitchToNoteWithOctave(value), // Convert midi pitch to note names
          },
        },
      },
    }

    // Create and render the chart
    const createChart = () => {
      // Destroy the existing chart instance if it exists
      if (chartInstance) {
        chartInstance.destroy()
      }

      // Skip if chartData is invalid or empty
      if (!props.chartData || !props.chartData.labels.length) return

      // Compute min/max pitch values and adjust canvas
      computeMinMaxPitch()

      // Create a new chart instance using chart.js
      chartInstance = new ChartJS(chartCanvas.value, {
        type: 'line', // Line chart type
        data: props.chartData,
        options: chartOptions,
      })
    }

    // Convert midi pitch to readable note name with octave (e.g., 'C4', 'D#5')
    const midiPitchToNoteWithOctave = (midi) => {
      if (midi === null || midi < 0) return ''
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      const octave = Math.floor(midi / 12) - 1
      const note = noteNames[midi % 12]
      return `${note}${octave}`.length == 3 ? null : `${note}${octave}`
    }

    // Lifecycle hook: component mounted
    onMounted(() => {
      createChart() // Create the chart when the component is mounted
    })

    // Watch for changes to chartData and re-render chart
    watch(props.chartData, () => {
      createChart()
    })

    // Return properties and methods to template
    return { chartCanvas }
  },
}
</script>

<style scoped></style>
