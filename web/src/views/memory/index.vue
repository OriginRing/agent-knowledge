<template>
  <a-flex class="memory-page" vertical>
    <a-flex justify="space-between">
      <a-button type="primary" @click="openMemory()">新增记忆</a-button>
      <a-flex justify="flex-end" gap="small">
        <a-input-search
          v-model:value="value"
          placeholder="记忆检索"
          :loading="loading"
          style="width: 250px"
          @search="onSearch"
        />
        <a-button @click="clearFilter">
          <template #icon>
            <ClearOutlined />
          </template>
        </a-button>
      </a-flex>
    </a-flex>

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
  padding: 8px;
}
.memory-list {
  flex: 1;
  margin: 8px 0;
  overflow: scroll;

  .ant-empty {
    margin-top: 120px;
  }
}

.memory-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.memory-textarea {
  margin: 24px 0;
}
</style>
