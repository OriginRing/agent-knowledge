<template>
  <div class="agent-history">
    <header class="page-header">
      <div>
        <span class="page-eyebrow">CONVERSATION ARCHIVE</span>
        <h2>管理对话</h2>
        <p>回到过去的灵感片段，或整理不再需要的会话。</p>
      </div>
    </header>
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
              aria-label="删除对话"
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
import { createChatLocation } from "@view/utils/chat-route";

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
    chatService.setActiveHistorySession(history.session_id);
    chatService.setNewConversation(history.session_id);
    chatService.setAgentHistoryDetail(history.records);
    await router.push(
      createChatLocation(history.agent_code, history.session_id),
    );
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
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 24px 28px 18px;
  overflow: hidden;
  color: var(--app-text);

  .agent-history-list {
    min-height: 0;
    padding: 4px;
    overflow: auto;
  }
}

.page-header {
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
  color: var(--app-peach);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.13em;
}

.ant-list-item {
  min-height: 76px;
  margin-bottom: 10px;
  padding: 12px 16px;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-card);
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-soft);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: rgba(113, 103, 232, 0.28);
    box-shadow: var(--app-shadow-hover);
    transform: translateY(-2px);
  }

  :deep(.ant-avatar) {
    color: var(--app-primary);
    background: var(--app-primary-soft);
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
    color: var(--app-text-tertiary);
    font-size: 12px;
    font-weight: 400;
  }
}

:deep(.ant-list-item-action) {
  margin-left: 16px !important;
}

@media (max-width: 768px) {
  .agent-history {
    padding: 18px 14px 12px;
  }

  .page-header {
    padding-bottom: 18px;
  }

  .history-title .date {
    display: none;
  }

  .ant-list-item {
    padding: 11px 12px;
  }
}
</style>
