<template>
  <div class="reference-list">
    <h2>
      参考资料 <small>{{ files.length }} 个文件</small>
    </h2>
    <p class="description">查看本次回答引用的知识片段。</p>
    <a-empty v-if="!files.length" description="暂无参考资料" />
    <a-card v-for="item in files" :key="item.fileId" class="reference-card">
      <template #title>
        <button
          class="reference-name"
          :title="item.fileName"
          :disabled="loading"
          @click="previewFile(item.fileName, item.fileUrl)"
        >
          {{ item.fileName }}
        </button>
      </template>
      <div class="card-content">
        <template v-for="(content, index) in item.fileContent" :key="index">
          <p>{{ content }}</p>
          <a-divider v-if="index < item.fileContent.length - 1" />
        </template>
      </div>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useChatStore } from "@view/stores/chat";

const chat = useChatStore();
const loading = ref(false);
let request: AbortController | null = null;
const normalize = (content: string | string[]) =>
  Array.isArray(content) ? content : [content];
const files = computed(() => {
  const merged = new Map<
    string,
    { fileId: string; fileName: string; fileUrl: string; fileContent: string[] }
  >();
  for (const doc of chat.agentPreviewFiles) {
    const existing = merged.get(doc.fileId);
    if (existing) existing.fileContent.push(...normalize(doc.fileContent));
    else
      merged.set(doc.fileId, {
        ...doc,
        fileContent: [...normalize(doc.fileContent)],
      });
  }
  return [...merged.values()];
});
const cancelRequest = () => {
  request?.abort();
  request = null;
  loading.value = false;
};
const previewFile = async (name: string, url: string) => {
  cancelRequest();
  const controller = new AbortController();
  request = controller;
  loading.value = true;
  const hide = message.loading("正在获取文件资源", 0);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (request !== controller || controller.signal.aborted) return;
    chat.setAgentPreviewFile(
      new File([blob], name, { type: blob.type }),
      "references",
    );
  } catch {
    if (!controller.signal.aborted) message.error("文件资源获取失败，请重试");
  } finally {
    hide();
    if (request === controller) {
      request = null;
      loading.value = false;
    }
  }
};
watch(
  () => [chat.agentPreview, chat.panelMode, chat.agentPreviewFiles],
  cancelRequest,
  { flush: "sync" },
);
onBeforeUnmount(cancelRequest);
</script>
<style scoped lang="less">
.reference-list {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
  h2 {
    padding-right: 36px;
    font-size: 20px;
  }
  small {
    font-size: 12px;
    color: var(--app-text-secondary);
    font-weight: normal;
  }
}
.description {
  color: var(--app-text-secondary);
  margin: 8px 0 20px;
}
.reference-card {
  margin-bottom: 16px;
}
.reference-name {
  display: block;
  max-width: 100%;
  padding: 4px 0;
  border: 0;
  background: transparent;
  color: var(--app-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
  &:hover {
    color: var(--app-mint);
  }
  &:focus-visible {
    outline: 2px solid var(--app-mint);
  }
}
.card-content {
  max-height: 150px;
  overflow-y: auto;
  overflow-wrap: anywhere;
  color: var(--app-text-secondary);
  line-height: 1.65;
}
@media (max-width: 768px) {
  .reference-list {
    padding: 14px;
  }
}
</style>
