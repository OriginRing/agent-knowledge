<template>
  <div class="agent-history">
    <div class="agent-history-list">
      <a-list :locale="{ emptyText: '暂无数据' }">
        <a-list-item
          v-for="item in historyList"
          :key="item.id"
          @click="selectHistory(item.id)"
        >
          <template #actions>
            <a-button
              danger
              type="text"
              size="small"
              @click="deleteHistory(item.id as string, $event)"
            >
              <DeleteOutlined />
            </a-button>
          </template>
          <a-skeleton avatar :title="false" :loading="false">
            <a-list-item-meta :description="item.content || '-'">
              <template #title>
                <div class="history-title">
                  <div class="history-title-text">
                    {{ item.preview ?? "-" }}
                  </div>
                  <span v-if="item?.created_at" class="date">
                    {{ dayjs(item.created_at).format("YYYY-MM-DD HH:mm:ss") }}
                  </span>
                </div>
              </template>
              <template #avatar>
                <a-avatar :size="32">
                  <template #icon><MessageOutlined /></template>
                </a-avatar>
              </template>
            </a-list-item-meta>
          </a-skeleton>
        </a-list-item>
      </a-list>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { DeleteOutlined, MessageOutlined } from "@ant-design/icons-vue";
import { useChatStore } from "@view/stores/chat";
import type { HistoryInterface } from "@view/interfaces/history-interface";
import { useRouter } from "vue-router";
import { message } from "ant-design-vue";
import httpClient from "@view/services/http";
import dayjs from "dayjs";

const chatService = useChatStore();
const router = useRouter();

const historyList = ref<HistoryInterface[]>([]);

const getAgentHistoryList = async () => {
  const res = await httpClient.post("/auth/history", {
    agentCode: chatService.getAgentDetail.agentCode,
  });
  if (res.code === 0) {
    historyList.value = res.data;
  } else {
    historyList.value = [];
  }
};

const selectHistory = async (key: string) => {
  const res = await httpClient.post("/auth/history/detail", {
    id: key,
  });
  if (res.code === 0) {
    const history = res.data;
    chatService.setNewConversation(history.session_id);
    chatService.setAgentHistoryDetail(history.records);
    await router.push("/");
  } else {
    chatService.setAgentHistoryDetail([]);
  }
};

const deleteHistory = async (key: string, event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  const res = await httpClient.post("/auth/history/delete", {
    agentCode: chatService.getAgentDetail.agentCode,
    id: key,
  });
  if (res.code === 0) {
    await getAgentHistoryList();
  } else {
    message.error("删除失败！");
  }
};

watch(
  () => chatService.getAgentDetail.agentCode,
  () => {
    getAgentHistoryList();
  },
  { flush: "sync" },
);

onMounted(() => {
  getAgentHistoryList();
});
</script>
<style scoped lang="less">
.agent-history {
  border-right: 1px solid var(--color-bg-border);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  overflow: hidden;

  .agent-history-list {
    overflow: scroll;
  }
}

.ant-list-item-meta {
  overflow: hidden;
  cursor: pointer;

  :deep(.ant-list-item-meta-title),
  :deep(.ant-list-item-meta-description) {
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.history-title {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .history-title-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date {
    flex: 0 0 130px;
    font-size: 12px;
    font-weight: 400;
  }
}

:deep(.ant-list-item-action) {
  margin-left: 16px !important;
}
</style>
