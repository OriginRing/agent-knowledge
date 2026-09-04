<template>
  <section
    v-if="chat.agentPreview"
    class="workspace-panel"
    aria-label="工作面板"
  >
    <a-button
      class="panel-close"
      type="text"
      shape="circle"
      :aria-label="closeLabel"
      :title="closeLabel"
      @click="chat.closeWorkspacePanel()"
      ><template #icon><CloseOutlined /></template
    ></a-button>
    <div class="panel-body">
      <CodeEditor
        v-if="chat.panelMode === 'code' && chat.codeDraft"
        :key="chat.codeDraft.id"
        v-model="chat.codeDraft.code"
        :language="chat.codeDraft.language"
      />
      <FilePreview
        v-else-if="chat.panelMode === 'file' && chat.agentPreviewFile"
        :file="chat.agentPreviewFile"
      />
      <ReferenceList v-else />
    </div>
  </section>
</template>
<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { CloseOutlined } from "@ant-design/icons-vue";
import { useChatStore } from "@view/stores/chat";
import FilePreview from "./components/file-preview.vue";
import ReferenceList from "./components/reference-list.vue";

const CodeEditor = defineAsyncComponent(
  () => import("./components/code-editor.vue"),
);
const chat = useChatStore();
const closeLabel = computed(() =>
  chat.canReturnToReferences ? "关闭文件，返回参考资料" : "关闭工作面板",
);
</script>
<style scoped lang="less">
.workspace-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 14px 14px 14px 0;
  height: calc(100% - 28px);
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-shell);
  color: var(--app-text);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
}
.panel-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  border: 1px solid var(--app-border-subtle);
  background: var(--app-surface-solid);
}
.panel-body {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
  :deep(.editor-toolbar),
  :deep(.ofv-toolbar) {
    padding-right: 52px;
  }
  :deep(.file-preview) {
    width: 100%;
    margin: 0;
    height: 100%;
    border: 0;
    border-radius: 0;
  }
}
@media (max-width: 768px) {
  .workspace-panel {
    margin: 8px;
    height: calc(100% - 16px);
    border-radius: 20px;
  }
}
</style>
