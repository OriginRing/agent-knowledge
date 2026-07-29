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
  width: 100%;
  height: 100%;
  position: relative;

  .close {
    position: absolute;
    top: 12px;
    right: 8px;
  }
}
</style>
