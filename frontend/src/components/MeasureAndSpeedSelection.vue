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

<script lang="ts">
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
      if (!isNaN(parsed) && parsed >= 1) {
        if (parsed > props.totalMeasures) {
          endMeasureInput.value = String(props.totalMeasures)
          emit('update:endMeasure', props.totalMeasures)
          startMeasureInput.value = String(props.totalMeasures)
          emit('update:startMeasure', props.totalMeasures)
        } else {
          startMeasureInput.value = String(parsed)
          emit('update:startMeasure', parsed)
        }
      } else {
        startMeasureInput.value = '1'
        emit('update:startMeasure', 1)
      }
    }

    const sanitizeEndMeasure = () => {
      const parsed = Math.round(parseFloat(endMeasureInput.value))
      const start = parseInt(startMeasureInput.value)
      if (!isNaN(parsed)) {
        if ((parsed < start && parsed > 0) || (parsed >= start && parsed <= props.totalMeasures)) {
          endMeasureInput.value = String(parsed)
          emit('update:endMeasure', parsed)
          if (parsed < start) {
            startMeasureInput.value = String(parsed)
            emit('update:startMeasure', parsed)
          }
        } else {
          endMeasureInput.value = String(props.totalMeasures)
          emit('update:endMeasure', props.totalMeasures)
        }
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
