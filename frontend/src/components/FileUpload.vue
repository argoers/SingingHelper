<template>
  <!-- Main container -->
  <div>
    <!-- Section title -->
    <h2 class="section-title">Soovitud partii sisselaulmiseks</h2>

    <!-- Upload file card -->
    <div class="card">
      <!-- Hidden file input triggered by button -->
      <input type="file" ref="fileInput" @change="handleFileUpload" hidden />

      <!-- Button to open file dialog -->
      <button :disabled="isRecordingProcessActive" @click="openFileDialog">Vali</button>

      <!-- Show selected file name if available -->
      <p v-if="selectedFile">Fail: {{ selectedFile.name }}</p>
    </div>
  </div>
</template>

<script lang="ts">
// Import Vue features
import { ref } from 'vue'

// Import API service to upload MusicXML
import { uploadMusicXml } from '../services/api'

export default {
  // Props passed from parent
  props: {
    isRecordingProcessActive: Boolean, // Disable uploading if recording is active
  },
  // Events this component emits
  emits: ['file-uploaded'],

  setup(props, { emit }) {
    // Store the selected file
    const selectedFile = ref(null)

    // Reference to hidden file input element
    const fileInput = ref(null)

    // Open file dialog when "Vali" button is clicked
    const openFileDialog = () => {
      fileInput.value.click()
    }

    // Handle file selection and upload
    const handleFileUpload = async (event) => {
      const file = event.target.files[0]
      if (!file) return // No file selected

      // Upload the selected file to backend
      const success = await uploadMusicXml(file)

      if (!success) {
        selectedFile.value = null // Reset if failed
      } else {
        selectedFile.value = file // Save selected file
      }

      // Inform parent whether upload succeeded
      emit('file-uploaded', success)
    }

    // Return variables and methods to template
    return { selectedFile, fileInput, openFileDialog, handleFileUpload }
  },
}
</script>
