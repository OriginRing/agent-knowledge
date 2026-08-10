<script setup lang="ts">
import { OpenFileViewer } from "@open-file-viewer/vue";
import {
  archivePlugin,
  audioPlugin,
  cadPlugin,
  drawingPlugin,
  emailPlugin,
  fallbackPlugin,
  gisPlugin,
  imagePlugin,
  model3dPlugin,
  officePlugin,
  pdfPlugin,
  textPlugin,
  videoPlugin,
  ofdPlugin,
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import { ref, watchEffect } from "vue";
import { useThemeStore } from "@view/stores/theme";
import { CloseOutlined } from "@ant-design/icons-vue";

const pdfWorkerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

const props = defineProps<{ file: File }>();
const emit = defineEmits(["close"]);
const themeService = useThemeStore();
const theme = ref(true);
const viewerRef = ref<{ reload: (target: File) => void } | null>(null);
const file = ref(props.file);

const plugins = [
  imagePlugin(),
  videoPlugin(),
  audioPlugin(),
  textPlugin(),
  pdfPlugin({ workerSrc: pdfWorkerSrc }),
  officePlugin(),
  archivePlugin(),
  emailPlugin(),
  drawingPlugin(),
  cadPlugin(),
  model3dPlugin(),
  gisPlugin(),
  fallbackPlugin(),
  ofdPlugin(),
];

const close = () => emit("close");

watchEffect(() => {
  theme.value = !themeService.getToggleDark;
});
watchEffect(() => {
  file.value = props.file;
  viewerRef.value?.reload?.(file.value);
});
</script>

<template>
  <div class="file-preview">
    <OpenFileViewer
      ref="viewerRef"
      :file="file"
      :file-name="file.name"
      height="100%"
      width="100%"
      toolbar
      :theme="theme ? 'light' : 'dark'"
      :plugins="plugins"
    >
    </OpenFileViewer>
    <a-button
      class="close"
      type="text"
      shape="circle"
      size="small"
      aria-label="关闭文件预览"
      @click="close"
    >
      <template #icon>
        <CloseOutlined />
      </template>
    </a-button>
  </div>
</template>
<style scoped lang="less">
.file-preview {
  width: calc(100% - 14px);
  height: calc(100% - 28px);
  margin: 14px 14px 14px 0;
  position: relative;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-shell);
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-soft);

  .close {
    position: absolute;
    top: 4px;
    right: 8px;
    z-index: 10;
    border: 1px solid var(--app-border-subtle);
    background: var(--app-surface);
  }
}

@media (max-width: 768px) {
  .file-preview {
    width: calc(100% - 16px);
    height: calc(100% - 16px);
    margin: 8px;
    border-radius: 20px;
  }
}
</style>
