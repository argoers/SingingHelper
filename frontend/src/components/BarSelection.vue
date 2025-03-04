<template>
  <div class="bar-selection">
    <label>Start Bar:</label>
    <input type="number" :value="startBar" @input="$emit('update:startBar', $event.target.value)" min="1" />

    <label>End Bar:</label>
    <input type="number" :value="endBar" @input="$emit('update:endBar', $event.target.value)" min="1" />
  </div>
</template>

<script>
export default {
  props: {
    startBar: Number,
    endBar: Number,
  },
  emits: ["update:startBar", "update:endBar"],
};
</script>

<style scoped>
.bar-selection {
  margin-bottom: 10px;
}
</style>