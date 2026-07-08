<template>
  <FilePreview v-if="file" :file="file" @close="closeFilePreview" />
  <div v-else class="file-preview">
    <a-button
      class="file-preview-close"
      type="text"
      shape="circle"
      @click="closePreview"
    >
      <template #icon>
        <CloseOutlined />
      </template>
    </a-button>
    <div class="file-list">
      <a-flex vertical gap="16">
        <a-card v-for="item in files" :key="item.fileId">
          <template #title>
            <a @click="previewFile(item.fileName, item.fileUrl)">{{
              item.fileName
            }}</a>
          </template>
          <div class="card-content">
            <template
              v-for="(val, index) in item.fileContent || []"
              :key="index"
            >
              <p>{{ val }}</p>
              <a-divider v-if="index !== item.fileContent.length - 1" />
            </template>
          </div>
        </a-card>
      </a-flex>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, watchEffect } from "vue";
import { useChatStore } from "@view/stores/chat";
import { CloseOutlined } from "@ant-design/icons-vue";
import type { KnowledgeDoc } from "@view/interfaces/agent-interface";
import FilePreview from "@view/components/file-preview.vue";
import { message } from "ant-design-vue";

const chatService = useChatStore();

const files = ref<KnowledgeDoc[]>([]);
const file = ref<File | null>(null);

const closePreview = () => {
  file.value = null;
  files.value = [];
  chatService.setAgentPreview(false);
  chatService.setAgentPreviewFiles([]);
  chatService.setAgentKnowledgeFile(null);
};

const closeFilePreview = () => {
  if (files.value.length > 0) {
    file.value = null;
  } else {
    closePreview();
  }
};

const mergeDocs = (docs: KnowledgeDoc[]): KnowledgeDoc[] => {
  const map = new Map<string, KnowledgeDoc>();

  docs.forEach((doc) => {
    if (map.has(doc.fileId)) {
      // 如果已存在该 fileId，将内容 push 到数组中
      map.get(doc.fileId)!.fileContent.push(doc.fileContent);
    } else {
      // 如果是首次出现，初始化数组并放入 Map
      map.set(doc.fileId, {
        fileName: doc.fileName,
        fileId: doc.fileId,
        fileContent: [doc.fileContent as string], // 注意：这里初始化为包含一个元素的数组
        fileUrl: doc.fileUrl,
        createdAt: doc.createdAt,
      });
    }
  });

  // 将 Map 的值转换为数组返回
  return Array.from(map.values());
};

const previewFile = async (name: string, url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      message.error(`文件资源获取失败`);
    }
    const blob = await response.blob();
    file.value = new File([blob], name, { type: blob.type });
  } catch (error) {
    console.error("转换文件失败:", error);
    throw error;
  }
};

watchEffect(() => {
  files.value = mergeDocs(chatService.getAgentPreviewFiles);
});

watchEffect(() => {
  file.value = chatService.getAgentKnowledgeFile;
});
</script>
<style lang="less" scoped>
.file-preview {
  padding: 20px 20px 0;
  position: relative;
  height: 100%;
  overflow: hidden;

  .file-list {
    width: 100%;
    height: 100%;
    overflow-y: scroll;
  }
  .file-preview-close {
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 99;
  }
}

.card-content {
  max-height: 150px;
  overflow-y: scroll;
}
</style>
