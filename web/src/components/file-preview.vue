<script setup lang="ts">
import { OpenFileViewer } from "@open-file-viewer/vue";
import {
  imagePlugin,
  officePlugin,
  pdfPlugin,
  textPlugin,
} from "@open-file-viewer/core";
import "@open-file-viewer/core/style.css";
import { ref, watchEffect } from "vue";
import { useThemeStore } from "@view/stores/theme";
import { LeftOutlined } from "@ant-design/icons-vue";

defineProps<{ file: File }>();
const emit = defineEmits(["close"]);
const themeService = useThemeStore();
const theme = ref(true);
const toolbar = {
  print: true,
  labels: {
    download: "下载",
    fullscreen: "全屏",
    search: "搜索",
    print: "打印",
  },
};

const plugins = [imagePlugin(), pdfPlugin(), officePlugin(), textPlugin()];

const close = () => emit("close");

watchEffect(() => {
  theme.value = !themeService.getToggleDark;
});
</script>

<template>
  <OpenFileViewer
    :file="file"
    :file-name="file.name"
    height="100%"
    :toolbar="toolbar"
    :theme="theme ? 'light' : 'dark'"
    :plugins="plugins"
  >
    <template #toolbar="ctx">
      <a-flex gap="small" justify="space-between" style="width: 100%">
        <a-flex gap="small">
          <a-button type="text" shape="circle" size="small" @click="close">
            <template #icon>
              <LeftOutlined />
            </template>
          </a-button>
          <a-button size="small" @click="ctx.download()">下载</a-button>
          <a-button size="small" @click="ctx.fullscreen()">全屏</a-button>
          <a-button size="small" @click="ctx.print()">打印</a-button>
        </a-flex>
        <a-input-search
          size="small"
          style="width: 150px"
          placeholder="搜索"
          @search="(val: string) => ctx.search(val)"
        />
      </a-flex>
    </template>
  </OpenFileViewer>
</template>
<style scoped lang="less">
.ant-btn-text {
  border: 0;
  background-color: transparent;
  &:hover {
    background-color: transparent;
  }
}
</style>
