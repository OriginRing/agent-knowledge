<template>
  <a-flex class="memory-page" vertical>
    <header class="page-header">
      <div>
        <span class="page-eyebrow">PERSONAL MEMORY</span>
        <h2>个人记忆</h2>
        <p>整理重要偏好与长期信息，让每一次对话都更懂你。</p>
      </div>
      <div class="page-actions">
        <a-button type="primary" @click="openMemory()">新增记忆</a-button>
        <a-input-search
          v-model:value="value"
          placeholder="记忆检索"
          :loading="loading"
          class="page-search"
          @search="onSearch"
        />
        <a-button aria-label="清除筛选" @click="clearFilter">
          <template #icon>
            <ClearOutlined />
          </template>
        </a-button>
      </div>
    </header>

    <div class="memory-list">
      <a-flex v-if="memoryList.length" vertical gap="12">
        <a-card v-for="(item, index) in memoryList" :key="index" size="small">
          <template #title>
            <a-flex justify="space-between" gap="small">
              <p class="memory-title">
                {{ item.memory_key }}
              </p>
              <a-flex gap="small">
                <a-button
                  size="small"
                  type="link"
                  aria-label="编辑记忆"
                  @click="openMemory(item.conversation_id)"
                >
                  <template #icon>
                    <FormOutlined />
                  </template>
                </a-button>
                <a-button
                  size="small"
                  type="link"
                  danger
                  aria-label="删除记忆"
                  @click="deleteMemory(item.id)"
                >
                  <template #icon>
                    <DeleteOutlined />
                  </template>
                </a-button>
              </a-flex>
            </a-flex>
          </template>
          <a-flex vertical gap="middle">
            <div class="card-content">
              {{ item.memory_value }}
            </div>
            <a-flex justify="space-between">
              <a-flex gap="small">
                <template v-for="tag in item.tags" :key="tag">
                  <a-tag :bordered="false" color="processing">{{ tag }}</a-tag>
                </template>
              </a-flex>
              <span style="width: 150px">
                {{ dayjs(item.create_time).format("YYYY-MM-DD HH:mm:ss") }}
              </span>
            </a-flex>
          </a-flex>
        </a-card>
      </a-flex>
      <a-skeleton v-else-if="loading" active />
      <a-empty v-else :image="simpleImage" description="暂无数据" />
    </div>
  </a-flex>
  <a-modal v-model:open="open" title="添加记忆" width="600px" centered>
    <a-alert
      v-if="conversation_id"
      message="对当前会话消息的反馈，基于用户的反馈更正记忆"
      type="warning"
      show-icon
    />
    <a-textarea
      v-model:value="memoryInput"
      show-count
      :rows="4"
      class="memory-textarea"
      placeholder="请输入记忆"
    />

    <template #footer>
      <a-button key="back" @click="handleCancel">取消</a-button>
      <a-button
        key="submit"
        type="primary"
        :loading="uploadLoading"
        @click="addMemory"
      >
        上传
      </a-button>
    </template>
  </a-modal>
</template>
<script setup lang="ts">
import { onMounted, ref } from "vue";
import { MemoryDetail } from "@view/interfaces/agent-interface";
import {
  ClearOutlined,
  DeleteOutlined,
  FormOutlined,
} from "@ant-design/icons-vue";
import { Empty, message } from "ant-design-vue";
import httpClient from "@view/services/http";
import dayjs from "dayjs";
import { useChatStore } from "@view/stores/chat";

const chatService = useChatStore();
const value = ref<string>("");
const memoryList = ref<MemoryDetail[]>([]);
const simpleImage = Empty.PRESENTED_IMAGE_SIMPLE;
const loading = ref(false);
const uploadLoading = ref(false);
const open = ref(false);
const memoryInput = ref("");
const conversation_id = ref("");

const openMemory = (cid?: string) => {
  if (cid) {
    conversation_id.value = cid;
  } else {
    conversation_id.value = "";
  }
  open.value = true;
};

const handleCancel = () => {
  open.value = false;
  memoryInput.value = "";
};

const onSearch = async (searchValue: string) => {
  loading.value = true;
  memoryList.value = [];
  try {
    const res = await httpClient.post("/auth/memory/search", {
      query: searchValue,
    });
    if (res.code === 0) {
      memoryList.value = res.data?.memory_detail_list || [];
    } else {
      memoryList.value = [];
    }
    loading.value = false;
  } catch (error) {
    loading.value = false;
    console.log(error);
  }
};

const getMemoryList = async () => {
  loading.value = true;
  memoryList.value = [];
  try {
    const res = await httpClient.post("/auth/memory/list", {
      page: 1,
      page_size: 10,
    });
    if (res.code === 0) {
      memoryList.value = res.data?.data?.memory_detail_list || [];
    } else {
      memoryList.value = [];
    }
    loading.value = false;
  } catch (error) {
    loading.value = false;
    console.log(error);
  }
};

const addMemory = async () => {
  uploadLoading.value = true;
  if (conversation_id.value) {
    await updateMemory();
    return;
  }
  try {
    const res = await httpClient.post("/auth/memory/add", {
      conversation_id: chatService.getUserDetail.username,
      messages: [
        {
          role: "user",
          content: memoryInput.value,
        },
      ],
    });
    if (res.code === 0) {
      message.success("记忆添加成功");
      await getMemoryList();
      handleCancel();
    }
    uploadLoading.value = false;
  } catch (err) {
    uploadLoading.value = false;
    console.log(err);
  }
};

const updateMemory = async () => {
  try {
    const res = await httpClient.post("/auth/memory/update", {
      conversation_id: conversation_id.value,
      feedback_content: memoryInput.value,
    });
    if (res.code === 0) {
      message.success("已对相关记忆进行订正");
      await getMemoryList();
      handleCancel();
    }
    uploadLoading.value = false;
  } catch (err) {
    uploadLoading.value = false;
    console.log(err);
  }
};

const deleteMemory = async (id: string) => {
  const res = await httpClient.post("/auth/memory/delete", { memo_id: id });
  if (res.code === 0) {
    message.success("记忆已删除");
    await getMemoryList();
  }
};

const clearFilter = async () => {
  memoryList.value = [];
  value.value = "";
  await getMemoryList();
};

onMounted(() => {
  getMemoryList();
});
</script>
<style lang="less" scoped>
.memory-page {
  width: 100%;
  height: 100%;
  padding: 24px 28px 18px;
  color: var(--app-text);
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
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
  color: var(--app-mint);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.page-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.page-search {
  width: 260px;

  :deep(.ant-input-group-addon .ant-btn) {
    min-width: 46px;
    border-radius: 0 14px 14px 0;
  }
}

.memory-list {
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

.memory-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--app-text);
  font-weight: 720;
}

.memory-textarea {
  margin: 24px 0;
}

@media (max-width: 900px) {
  .page-header {
    align-items: stretch;
    flex-direction: column;
  }

  .page-actions {
    flex-wrap: wrap;
  }

  .page-search {
    min-width: 210px;
    flex: 1;
  }
}

@media (max-width: 768px) {
  .memory-page {
    padding: 18px 14px 12px;
  }

  .page-header {
    padding-bottom: 18px;
  }

  .page-actions {
    > :deep(.ant-btn-primary) {
      flex: 1 0 100%;
    }
  }
}
</style>
