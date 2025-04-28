<template>
  <!-- Section title -->
  <h2 class="section-title">Sisselaulmine</h2>

  <!-- Card container for recording controls -->
  <div class="card">
    <!-- Controls shown when there are notes available -->
    <div v-show="musicXmlNoteInfo && musicXmlNoteInfo.length > 0" class="input-group">
      <!-- Button to start recording -->
      <button @click="$emit('start-recording')" :disabled="disabled" v-if="selectedPart">
        {{ countdown > 0 ? `Salvestamine algab ${countdown}...` : 'Alusta salvestamist' }}
      </button>

      <!-- Button to cancel (stop) recording -->
      <button @click="$emit('cancel-recording')" v-if="isInCountdown || isRecording">
        Lõpeta salvestamine
      </button>

      <!-- Button to play the first note before recording -->
      <button
        @click="$emit('play-first-note')"
        :disabled="isNoteBeingPlayed"
        v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
      >
        Mängi esimest nooti
      </button>
    </div>

    <!-- Message if there are no notes to record -->
    <div v-show="musicXmlNoteInfo && musicXmlNoteInfo.length <= 0">
      Partiil pole ühtegi nooti antud taktivahemikus
    </div>
  </div>
</template>

<script lang="ts">
// Setup for RecordingControls component
export default {
  name: 'RecordingControls', // Component name

  // Props passed from parent
  props: {
    selectedPart: String, // Current selected part (e.g., Soprano)
    isRecording: Boolean, // Is recording active
    isProcessingAudio: Boolean, // Is audio being processed
    isNoteBeingPlayed: Boolean, // Is a note being played
    isInCountdown: Boolean, // Is countdown active
    countdown: Number, // Countdown number (seconds)
    disabled: Boolean, // Disable button flag
    musicXmlNoteInfo: Object, // Notes extracted from MusicXML
  },

  // Events emitted upwards to parent
  emits: [
    'start-recording', // Start recording signal
    'cancel-recording', // Cancel recording signal
    'play-first-note', // Play first note signal
  ],
}
</script>

<style scoped></style>
