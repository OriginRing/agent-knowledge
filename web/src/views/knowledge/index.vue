<template>
  <a-flex class="knowledge-page" vertical>
    <header class="page-header">
      <div>
        <span class="page-eyebrow">KNOWLEDGE SPACE</span>
        <h2>知识库检索</h2>
        <p>从已上传的资料中，快速找到与你的问题最相关的内容。</p>
      </div>
      <a-input-search
        v-model:value="value"
        placeholder="知识库检索"
        :loading="loading"
        class="page-search"
        @search="onSearch"
      />
    </header>

    <div class="knowledge-list">
      <a-flex v-if="knowledgeList.length" vertical gap="12">
        <a-card
          v-for="(item, index) in knowledgeList"
          :key="index"
          size="small"
        >
          <template #title>
            <a-flex justify="space-between" gap="small">
              <a
                class="knowledge-title"
                @click="previewFile(item.fileName, item.fileUrl)"
              >
                {{ item.fileName }}
              </a>
              <span style="width: 150px">
                {{ dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") }}
              </span>
            </a-flex>
          </template>
          <a-tag v-if="item.sourceLabel" color="blue">
            {{ item.sourceLabel }}
          </a-tag>
          <div class="card-content">
            {{ item.fileContent }}
          </div>
        </a-card>
      </a-flex>
      <a-skeleton v-else-if="loading" active />
      <a-empty v-else :image="simpleImage" description="暂无数据" />
    </div>
  </a-flex>
</template>
<script setup lang="ts">
import { ref } from "vue";
import { KnowledgeDoc } from "@view/interfaces/agent-interface";
import { Empty, message } from "ant-design-vue";
import httpClient from "@view/services/http";
import dayjs from "dayjs";
import { useChatStore } from "@view/stores/chat";

const chatService = useChatStore();
const value = ref<string>("");
const knowledgeList = ref<KnowledgeDoc[]>([]);
const file = ref<File | null>(null);
const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;
const loading = ref(false);

const onSearch = async (searchValue: string) => {
  loading.value = true;
  knowledgeList.value = [];
  try {
    const res = await httpClient.post("/agent/knowledge", {
      search: searchValue,
    });
    if (res.code === 0) {
      knowledgeList.value = res.data;
    } else {
      knowledgeList.value = [];
    }
    loading.value = false;
  } catch (error) {
    loading.value = false;
    console.log(error);
  }
};

const previewFile = async (name: string, url: string) => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      message.error(`文件资源获取失败`);
    }
    const blob = await response.blob();
    file.value = new File([blob], name, { type: blob.type });

    chatService.setAgentPreview(true);
    chatService.setAgentTool(false);
    chatService.setAgentPreviewFile(file.value);
  } catch (error) {
    console.error("转换文件失败:", error);
    throw error;
  }
};
</script>
<style lang="less" scoped>
.knowledge-page {
  width: 100%;
  height: 100%;
  padding: 24px 28px 18px;
  color: var(--app-text);
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 6px 4px 22px;

  h2 {
    margin-top: 3px;
    color: var(--app-text);
    font-size: clamp(24px, 3vw, 32px);
    line-height: 1.25;
    letter-spacing: -0.035em;
  }

  p {
    margin-top: 7px;
    color: var(--app-text-secondary);
    font-size: 14px;
  }
}

.page-eyebrow {
  color: var(--app-primary);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.page-search {
  width: min(300px, 100%);

  :deep(.ant-input-group-addon .ant-btn) {
    min-width: 46px;
    border-radius: 0 14px 14px 0;
  }
}

.knowledge-list {
  flex: 1;
  min-height: 0;
  padding: 4px;
  overflow: auto;

  .ant-empty {
    margin-top: 100px;
  }

  :deep(.ant-card-body) {
    color: var(--app-text-secondary);
    line-height: 1.7;
  }
}

.knowledge-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-primary);
  font-weight: 720;
}

@media (max-width: 768px) {
  .knowledge-page {
    padding: 18px 14px 12px;
  }

  .page-header {
    align-items: stretch;
    flex-direction: column;
    gap: 16px;
    padding-bottom: 18px;
  }

  .page-search {
    width: 100%;
  }
}
</style>
