<template>
  <a-button
    v-if="updateAvailable"
    class="app-update-button"
    type="primary"
    aria-label="发现新版本，立即更新页面"
    @click="reloadToUpdate"
  >
    立即更新
  </a-button>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { createAppUpdateChecker } from "@view/utils/app-update";

const { updateAvailable, reloadToUpdate, start, stop } = createAppUpdateChecker(
  {
    currentVersion: import.meta.env.APP_VERSION,
    enabled: import.meta.env.PROD,
  },
);

onMounted(start);
onBeforeUnmount(stop);
</script>

<style scoped lang="less">
.app-update-button {
  min-width: 88px;
  min-height: 40px;
  border-radius: 999px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .app-update-button {
    min-width: 76px;
    min-height: 40px;
    padding-inline: 12px;
    font-size: 13px;
  }
}
</style>
