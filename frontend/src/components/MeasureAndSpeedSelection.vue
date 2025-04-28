<template>
  <!-- Show only if a part is selected -->
  <div v-if="selectedPart">
    <!-- Section title -->
    <h2 class="section-title">Takti ja kiiruse valik</h2>

    <!-- Card container for inputs -->
    <div class="card">
      <!-- Input for starting measure -->
      <div class="input-group">
        <label>Algtakt:</label>
        <input
          :disabled="disabled"
          type="text"
          v-model="startMeasureInput"
          @blur="sanitizeStartMeasure"
        />
      </div>

      <!-- Input for ending measure -->
      <div class="input-group">
        <label>Lõpptakt:</label>
        <input
          :disabled="disabled"
          type="text"
          v-model="endMeasureInput"
          @blur="sanitizeEndMeasure"
        />
      </div>

      <!-- Input for playback speed percentage -->
      <div class="input-group">
        <label>Kiirus (%):</label>
        <input :disabled="disabled" type="text" v-model="speedInput" @blur="sanitizeSpeed" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
// Import Vue Composition API features
import { ref, watch, defineComponent, onMounted } from 'vue'

export default defineComponent({
  // Define props passed from parent
  props: {
    selectedPart: String, // Current selected part
    startMeasure: Number, // Starting measure (from parent)
    endMeasure: Number, // Ending measure (from parent)
    speed: Number, // Playback speed (as multiplier, e.g., 1.0)
    disabled: Boolean, // Whether inputs are disabled
    totalMeasures: Number, // Total measures available in the song
  },
  emits: [
    'update:startMeasure', // Emit updated start measure
    'update:endMeasure', // Emit updated end measure
    'update:speed', // Emit updated playback speed
  ],
  setup(props, { emit }) {
    // Local reactive inputs, synced with text fields
    const startMeasureInput = ref(String(props.startMeasure))
    const endMeasureInput = ref(String(props.endMeasure))
    const speedInput = ref(String(props.speed))

    // Set default speed to 100% after component mounted
    onMounted(() => {
      speedInput.value = '100'
    })

    // Watch for parent prop changes and update local input fields
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

    // Validate and sanitize start measure input
    const sanitizeStartMeasure = () => {
      const parsed = Math.round(parseFloat(startMeasureInput.value))
      if (!isNaN(parsed) && parsed >= 1) {
        if (parsed > props.totalMeasures) {
          // If too large, set to max measures
          endMeasureInput.value = String(props.totalMeasures)
          emit('update:endMeasure', props.totalMeasures)
          startMeasureInput.value = String(props.totalMeasures)
          emit('update:startMeasure', props.totalMeasures)
        } else {
          startMeasureInput.value = String(parsed)
          emit('update:startMeasure', parsed)
        }
      } else {
        // If invalid, fallback to measure 1
        startMeasureInput.value = '1'
        emit('update:startMeasure', 1)
      }
    }

    // Validate and sanitize end measure input
    const sanitizeEndMeasure = () => {
      const parsed = Math.round(parseFloat(endMeasureInput.value))
      const start = parseInt(startMeasureInput.value)
      if (!isNaN(parsed)) {
        if ((parsed < start && parsed > 0) || (parsed >= start && parsed <= props.totalMeasures)) {
          endMeasureInput.value = String(parsed)
          emit('update:endMeasure', parsed)

          // If end before start, adjust start also
          if (parsed < start) {
            startMeasureInput.value = String(parsed)
            emit('update:startMeasure', parsed)
          }
        } else {
          // If invalid, set to max measures
          endMeasureInput.value = String(props.totalMeasures)
          emit('update:endMeasure', props.totalMeasures)
        }
      } else {
        // Fallback to max if not a number
        endMeasureInput.value = String(props.totalMeasures)
        emit('update:endMeasure', props.totalMeasures)
      }
    }

    // Validate and sanitize speed input
    const sanitizeSpeed = () => {
      const parsed = Math.round(parseFloat(speedInput.value))
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1000) {
        speedInput.value = String(parsed)
        emit('update:speed', parsed / 100)
      } else {
        // Default to 100% if invalid
        speedInput.value = '100'
        emit('update:speed', 1)
      }
    }

    // Return variables and functions to template
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

<style scoped>
/* Card layout styling */
.card {
  display: flex;
  gap: 3rem;
  align-items: center;
}
</style>
