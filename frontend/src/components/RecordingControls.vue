<template>
  <h2 class="section-title">Sisselaulmine</h2>
  <div class="card">
    <div v-show="musicXmlNoteInfo && musicXmlNoteInfo.length > 0">
      <button
        @click="$emit('start-recording')"
        :disabled="disabled"
        v-if="selectedPart && !isRecording && !isProcessingAudio"
      >
        {{ countdown > 0 ? `Salvestamine algab ${countdown}...` : 'Alusta salvestamist' }}
      </button>

      <button @click="$emit('cancel-recording')" v-if="isInCountdown || isRecording">
        Lõpeta salvestamine
      </button>

      <button
        @click="$emit('play-first-note')"
        :disabled="isNoteBeingPlayed"
        v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
      >
        Mängi esimest nooti
      </button>
    </div>
    <div v-show="musicXmlNoteInfo && musicXmlNoteInfo.length <= 0">
      Partiil pole ühtegi nooti antud taktivahemikus
    </div>
  </div>
</template>

<script lang="ts">
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
    musicXmlNoteInfo: Object,
  },
  emits: ['start-recording', 'cancel-recording', 'play-first-note'],
}
</script>

<style scoped></style>
