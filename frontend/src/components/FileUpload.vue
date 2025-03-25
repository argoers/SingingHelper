<template>
  <div>
    <h2 class="section-title">Soovitud partii sisselaulmiseks</h2>
    <div class="card">
      <input type="file" ref="fileInput" @change="handleFileUpload" hidden />
      <button :disabled="isRecordingProcessActive" @click="openFileDialog">Vali</button>
      <p v-if="selectedFile">Fail: {{ selectedFile.name }}</p>
    </div>
  </div>
</template>

<script lang="js">
import { ref } from 'vue'
import { uploadMusicXml } from '../services/api'

export default {
  props: {
    isRecordingProcessActive: Boolean,
  },
  emits: ['file-uploaded'],
  setup(props, { emit }) {
    const selectedFile = ref(null)
    const fileInput = ref(null)

    const openFileDialog = () => {
      fileInput.value.click()
    }

    const handleFileUpload = async (event) => {
      const file = event.target.files[0]
      if (!file) return

      const success = await uploadMusicXml(file)

      if (!success) {
        selectedFile.value = null
      } else {
        selectedFile.value = file
      }

      emit('file-uploaded', success)
    }

    return { selectedFile, fileInput, openFileDialog, handleFileUpload }
  },
}
</script>
