<template>
  <div class="file-upload">
    <input type="file" ref="fileInput" @change="handleFileUpload" hidden />
    <button @click="openFileDialog">📂 Upload MIDI File</button>
    <p v-if="selectedFile">Selected file: {{ selectedFile.name }}</p>
  </div>
</template>

<script>
import { ref } from "vue";
import { uploadFile } from "../services/api";

export default {
  emits: ["file-uploaded"],
  setup(_, { emit }) {
    const selectedFile = ref(null);
    const fileInput = ref(null);

    const openFileDialog = () => {
      fileInput.value.click();
    };

    const handleFileUpload = async (event) => {
      selectedFile.value = event.target.files[0];

      if (!selectedFile.value) return;

      const success = await uploadFile(selectedFile.value);
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
</style>