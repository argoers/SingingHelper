<template>
  <div v-if="selectedPart">
    <h2 class="section-title">Takti ja kiiruse valik</h2>
    <div class="card">
      <label>Algtakt:</label>
      <input
        :disabled="disabled"
        type="text"
        v-model="startMeasureInput"
        @blur="sanitizeStartMeasure"
      />

      <label>Lõpptakt:</label>
      <input
        :disabled="disabled"
        type="text"
        v-model="endMeasureInput"
        @blur="sanitizeEndMeasure"
      />

      <label>Kiirus (%):</label>
      <input :disabled="disabled" type="text" v-model="speedInput" @blur="sanitizeSpeed" />
    </div>
  </div>
</template>

<script>
import { ref, watch, defineComponent, onMounted } from 'vue'

export default defineComponent({
  props: {
    selectedPart: String,
    startMeasure: Number,
    endMeasure: Number,
    speed: Number,
    disabled: Boolean,
    totalMeasures: Number,
  },
  emits: ['update:startMeasure', 'update:endMeasure', 'update:speed'],
  setup(props, { emit }) {
    const startMeasureInput = ref(String(props.startMeasure))
    const endMeasureInput = ref(String(props.endMeasure))
    const speedInput = ref(String(props.speed))
    onMounted(() => {
      speedInput.value = '100'
    })
    watch(
      () => props.startMeasure,
      (val) => {
        startMeasureInput.value = String(val)
      },
    )
    watch(
      () => props.endMeasure,
      (val) => {
        endMeasureInput.value = String(val)
      },
    )
    watch(
      () => props.speed,
      (val) => {
        speedInput.value = String(Math.round(val * 100))
      },
    )

    const sanitizeStartMeasure = () => {
      const parsed = Math.round(parseFloat(startMeasureInput.value))
      if (!isNaN(parsed) && parsed >= 1 && parsed <= props.totalMeasures) {
        startMeasureInput.value = String(parsed)
        emit('update:startMeasure', parsed)

        const end = parseInt(endMeasureInput.value)
        if (end < parsed) {
          endMeasureInput.value = String(parsed)
          emit('update:endMeasure', parsed)
        }
      } else {
        startMeasureInput.value = '1'
        emit('update:startMeasure', 1)
      }
    }

    const sanitizeEndMeasure = () => {
      const parsed = Math.round(parseFloat(endMeasureInput.value))
      const start = parseInt(startMeasureInput.value)
      if (!isNaN(parsed) && parsed >= start && parsed <= props.totalMeasures) {
        endMeasureInput.value = String(parsed)
        emit('update:endMeasure', parsed)
      } else {
        endMeasureInput.value = String(props.totalMeasures)
        emit('update:endMeasure', props.totalMeasures)
      }
    }

    const sanitizeSpeed = () => {
      const parsed = Math.round(parseFloat(speedInput.value))
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        speedInput.value = String(parsed)
        emit('update:speed', parsed / 100)
      } else {
        speedInput.value = '100'
        emit('update:speed', 1)
      }
    }

    return {
      startMeasureInput,
      endMeasureInput,
      speedInput,
      sanitizeStartMeasure,
      sanitizeEndMeasure,
      sanitizeSpeed,
    }
  },
})
</script>

<style scoped></style>
