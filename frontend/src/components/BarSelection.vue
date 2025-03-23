<template>
    <div class="bar-selection" v-if="selectedPart">
      <label>Start Bar:</label>
      <input
        :disabled="disabled"
        type="text"
        v-model="startBarInput"
        @blur="sanitizeStartBar"
      />
  
      <label>End Bar:</label>
      <input
        :disabled="disabled"
        type="text"
        v-model="endBarInput"
        @blur="sanitizeEndBar"
      />
  
      <label>Tempo (%):</label>
      <input
        :disabled="disabled"
        type="text"
        v-model="tempoInput"
        @blur="sanitizeTempo"
      />
    </div>
  </template>
  
  <script>
  import { ref, watch, defineComponent } from 'vue'
  
  export default defineComponent({
    name: 'BarSelection',
    props: {
      selectedPart: String,
      startBar: Number,
      endBar: Number,
      tempo: Number,
      disabled: Boolean,
      totalBars: Number,
    },
    emits: ['update:startBar', 'update:endBar', 'update:tempo'],
    setup(props, { emit }) {
      const startBarInput = ref(String(props.startBar))
      const endBarInput = ref(String(props.endBar))
      const tempoInput = ref(String(props.tempo))
  
      watch(() => props.startBar, (val) => { startBarInput.value = String(val) })
      watch(() => props.endBar, (val) => { endBarInput.value = String(val) })
      watch(() => props.tempo, (val) => { tempoInput.value = String(val) })
  
      const sanitizeStartBar = () => {
        const parsed = Math.round(parseFloat(startBarInput.value))
        if (!isNaN(parsed) && parsed >= 1 && parsed <= props.totalBars) {
          startBarInput.value = String(parsed)
          emit('update:startBar', parsed)
  
          const end = parseInt(endBarInput.value)
          if (end < parsed) {
            endBarInput.value = String(parsed)
            emit('update:endBar', parsed)
          }
        } else {
          startBarInput.value = '1'
          emit('update:startBar', 1)
        }
      }
  
      const sanitizeEndBar = () => {
        const parsed = Math.round(parseFloat(endBarInput.value))
        const start = parseInt(startBarInput.value)
        if (!isNaN(parsed) && parsed >= start && parsed <= props.totalBars) {
          endBarInput.value = String(parsed)
          emit('update:endBar', parsed)
        } else {
          endBarInput.value = String(props.totalBars)
          emit('update:endBar', props.totalBars)
        }
      }
  
      const sanitizeTempo = () => {
        const parsed = Math.round(parseFloat(tempoInput.value))
        const valid = !isNaN(parsed) && parsed > 0 ? parsed : 100
        tempoInput.value = String(valid)
        emit('update:tempo', valid)
      }
  
      return {
        startBarInput,
        endBarInput,
        tempoInput,
        sanitizeStartBar,
        sanitizeEndBar,
        sanitizeTempo,
      }
    },
  })
  </script>
  
  <style scoped>
  .bar-selection {
    margin-bottom: 10px;
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  </style>
  