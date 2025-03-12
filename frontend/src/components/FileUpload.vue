<template>
  <div class="file-upload">
    <input type="file" ref="fileInput" @change="handleFileUpload" hidden />
    <button :disabled="isRecordingProcessActive" @click="openFileDialog">📂 Upload MIDI File</button>
    <p v-if="selectedFile">Selected file: {{ selectedFile.name }}</p>
  </div>
</template>

<script>
import { ref } from "vue";
import { uploadFile } from "../services/api";

export default {
  props: {
    isRecordingProcessActive: Boolean,
  },
  emits: ["file-uploaded"],
  setup(props, { emit }) {
    const selectedFile = ref(null);
    const fileInput = ref(null);

    const openFileDialog = () => {
      fileInput.value.click();
    };

    const handleFileUpload = async (event) => {
      const file = event.target.files[0]
      if (!file) return;

      const success = await uploadFile(file);

      if (!success) {
        selectedFile.value = null;
      } else {
        selectedFile.value = file;
      }

      emit("file-uploaded", success);
    };

    return { selectedFile, fileInput, openFileDialog, handleFileUpload };
  },
};
</script>

<style scoped>
.file-upload button {
  background-color: #008CBA;
  color: white;
  padding: 10px 15px;
  cursor: pointer;
  border-radius: 5px;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style>