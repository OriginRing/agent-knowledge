<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
const props = defineProps<{ value: unknown; rows?: number }>();
const emit = defineEmits<{ "update:value": [unknown]; invalid: [boolean] }>();
const raw = ref(JSON.stringify(props.value, null, 2) ?? ""),
  invalid = ref(false);
watch(
  () => props.value,
  (value) => {
    if (!invalid.value) raw.value = JSON.stringify(value, null, 2) ?? "";
  },
);
function input(value: string) {
  raw.value = value;
  try {
    const parsed = JSON.parse(value);
    invalid.value = false;
    emit("update:value", parsed);
  } catch {
    invalid.value = true;
  }
  emit("invalid", invalid.value);
}
onBeforeUnmount(() => emit("invalid", false));
</script>
<template>
  <a-textarea
    :value="raw"
    :rows="rows || 4"
    :status="invalid ? 'error' : undefined"
    @change="input($event.target.value || '')"
  />
  <small v-if="invalid" class="json-error"
    >JSON 格式不正确，请修正后保存。</small
  >
</template>
