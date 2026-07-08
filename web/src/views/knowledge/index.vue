<template>
  <a-flex class="knowledge-page" vertical>
    <a-flex justify="flex-end">
      <a-input-search
        v-model:value="value"
        placeholder="知识库检索"
        :loading="loading"
        style="width: 250px"
        @search="onSearch"
      />
    </a-flex>

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
    chatService.setAgentKnowledgeFile(file.value);
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
  padding: 8px;
}
.knowledge-list {
  flex: 1;
  margin: 8px 0;
  overflow: scroll;

  .ant-empty {
    margin-top: 120px;
  }
}

.knowledge-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
