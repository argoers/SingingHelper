<template>
  <!-- Section title -->
  <h2 class="section-title">Sisselaulmine</h2>

  <!-- Card container for recording controls -->
  <div class="card">
    <!-- Controls shown when there are notes available -->
    <div v-show="musicXmlNoteInfo && musicXmlNoteInfo.length > 0" class="input-group">
      <!-- Button to start recording -->
      <button
        @click="$emit('start-recording')"
        :disabled="disabled || isNoteBeingPlayed || isSnippetPlaying"
        v-if="selectedPart"
      >
        {{
          isInCountdown && countdown > 0
            ? `Salvestamine algab ${countdown}...`
            : 'Alusta salvestamist'
        }}
      </button>

      <!-- Button to cancel (stop) recording -->
      <button @click="$emit('cancel-recording')" v-if="isInCountdown || isRecording">
        Lõpeta salvestamine
      </button>

      <!-- Button to play the first note before recording -->
      <button
        @click="$emit('play-first-note')"
        :disabled="isNoteBeingPlayed || isSnippetPlaying"
        v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
      >
        Mängi esimest nooti
      </button>

      <button
        @click="$emit('toggle-snippet-play')"
        :disabled="isNoteBeingPlayed"
        v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
      >
        {{
          isSnippetPlaying
            ? 'Peata lõigu mängimine'
            : isInTheMiddleOfSnippet
              ? 'Jätka lõigu mängimist'
              : 'Mängi lõik ette'
        }}
      </button>

      <button
        @click="$emit('reset-snippet')"
        :disabled="isNoteBeingPlayed"
        v-if="
          selectedPart &&
          !isRecording &&
          !isInCountdown &&
          !isProcessingAudio &&
          isInTheMiddleOfSnippet
        "
      >
        Lõik algusesse tagasi
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
    isSnippetPlaying: Boolean, // Is snippet playing
    isInTheMiddleOfSnippet: Boolean, // Is in the middle of a snippet
  },

  // Events emitted upwards to parent
  emits: [
    'start-recording', // Start recording signal
    'cancel-recording', // Cancel recording signal
    'play-first-note', // Play first note signal
    'toggle-snippet-play', // Play snippet signal
    'reset-snippet', // Reset snippet signal
  ],
}
</script>

<style scoped></style>
