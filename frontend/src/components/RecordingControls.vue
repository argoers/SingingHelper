<template>
    <div class="recording-controls">
      <button
        @click="$emit('start-recording')"
        :disabled="disabled || isInCountdown"
        v-if="selectedPart && !isRecording && !isProcessingAudio"
      >
        {{ countdown > 0 ? `Recording starting in ${countdown}...` : 'Start Recording' }}
      </button>
  
      <button
        @click="$emit('cancel-recording')"
        v-if="isRecording"
      >
        Cancel Recording
      </button>
  
      <button
        @click="$emit('play-first-note')"
        :disabled="isNoteBeingPlayed"
        v-if="selectedPart && !isRecording && !isInCountdown && !isProcessingAudio"
      >
        Play First Note
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
  
  <style scoped>
  .recording-controls {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    margin: 1em 0;
  }
  
  button {
    background-color: #4caf50;
    color: white;
    border: none;
    padding: 10px 20px;
    font-size: 16px;
    cursor: pointer;
    border-radius: 5px;
  }
  
  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
  </style>
  