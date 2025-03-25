<template>
  <div class="card">
    <h2 class="section-title">Laulmise graafik takti kaupa</h2>

    <div class="card">
      <button @click="$emit('toggle-chart')">
        {{ showChart ? 'Peida' : 'Näita' }}
      </button>
    </div>
    <div class="chart-container" v-show="showChart">
      <canvas ref="chartCanvas"></canvas>
    </div>
  </div>
</template>

<script lang="js">
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
import { ref, watch, onMounted } from 'vue'

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
  props: {
    chartData: Object,
    isRecordingCancelled: Boolean,
    showChart: Boolean,
  },
  emits: ['toggle-chart'],
  setup(props, { emit }) {
    const chartCanvas = ref(null)
    let chartInstance = null

    const computeMinMaxPitch = () => {
      const allPitches = props.chartData.datasets
        .flatMap((dataset) => dataset.data)
        .filter((value) => value !== null) // Remove null values
      if (!allPitches) return
      chartOptions.scales.y.min = Math.floor(Math.min(...allPitches)) - 1
      chartOptions.scales.y.max = Math.ceil(Math.max(...allPitches)) + 1
      chartCanvas.value.height = (chartOptions.scales.y.max - chartOptions.scales.y.min) * 50
    }

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' },
        title: {
          display: true,
          text: '',
        },
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            stepSize: 1,
            maxRotation: 0,
            callback: (value, index) =>
              props.chartData.labels[index] ? props.chartData.labels[index] : null,
          },
        },
        y: {
          ticks: {
            autoSkip: false,
            stepSize: 1,
            callback: (value) => midiPitchToNoteWithOctave(value),
          },
        },
      },
    }

    const createChart = () => {
      if (chartInstance) {
        chartInstance.destroy()
      }

      if (!props.chartData || !props.chartData.labels.length) return
      computeMinMaxPitch()
      chartInstance = new ChartJS(chartCanvas.value, {
        type: 'line',
        data: props.chartData,
        options: chartOptions,
      })
    }

    const midiPitchToNoteWithOctave = (midi) => {
      if (midi === null || midi < 0) return ''
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
      const octave = Math.floor(midi / 12) - 1
      const note = noteNames[midi % 12]
      return `${note}${octave}`
    }

    onMounted(() => {
      createChart()
    })

    watch(props.chartData, () => {
      createChart()
    })

    return { chartCanvas }
  },
}
</script>

<style scoped></style>
