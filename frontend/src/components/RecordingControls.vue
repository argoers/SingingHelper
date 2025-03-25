<template>
  <h2 class="section-title">Sisselaulmine</h2>
  <div class="card">
    <button
      @click="$emit('start-recording')"
      :disabled="disabled || isInCountdown"
      v-if="selectedPart && !isRecording && !isProcessingAudio"
    >
      {{ countdown > 0 ? `Salvestamine algab ${countdown}...` : 'Alusta salvestamist' }}
    </button>

    <button @click="$emit('cancel-recording')" v-if="isRecording">Lõpeta salvestamine</button>

    <button
      @click="$emit('play-first-note')"
      :disabled="isNoteBeingPlayed"
      v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
    >
      Mängi esimest nooti
    </button>
  </div>
</template>

<script>
export default {
  name: 'RecordingControls',
  props: {
    selectedPart: String,
    isRecording: Boolean,
    isProcessingAudio: Boolean,
    isNoteBeingPlayed: Boolean,
    isInCountdown: Boolean,
    countdown: Number,
    disabled: Boolean,
  },
  emits: ['start-recording', 'cancel-recording', 'play-first-note'],
}
</script>

<style scoped></style>
