<template>
  <div class="chart-container">
    <LineChart v-if="chartData.labels.length" :chart-data="chartData" :chart-options="chartOptions" />
  </div>
</template>

<script>
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
  CategoryScale,
} from "chart.js";

ChartJS.register(Title, Tooltip, Legend, LineController, LineElement, PointElement, LinearScale, CategoryScale);

export default {
  components: { LineChart },
  props: {
    chartData: Object,
  },
  setup() {
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top" } },
    };

    return { chartOptions };
  },
};
</script>

<style scoped>
.chart-container {
  width: 100%;
  /* ✅ Ensure it takes full width */
  max-width: 1200px;
  /* ✅ Expand if needed */
  margin: auto;
}
</style>