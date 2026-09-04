<template>
  <div
    class="agent-tool"
    :style="{
      '--color-bg-layout': token.colorBorder,
      '--color-bg-border': token.colorSplit,
    }"
  >
    <div class="agent-header">
      <button
        class="mobile-close"
        type="button"
        aria-label="关闭侧栏"
        @click="chatService.setAgentTool(false)"
      >
        <CloseOutlined />
      </button>
      <button class="brand-button" type="button" @click="newConversation">
        <span class="brand-mark"><MessageOutlined /></span>
        <span>
          <strong>Ollama</strong>
          <small>知识伙伴</small>
        </span>
      </button>
    </div>
    <div class="agent-action">
      <AgentKnowledge />
    </div>
    <div class="agent-history-list">
      <a-list :locale="{ emptyText: '暂无数据' }">
        <template #header>
          <router-link class="history-list-title" to="/history">
            历史对话
          </router-link>
        </template>
        <a-list-item
          v-for="item in historyList"
          :key="item.id"
          :class="{
            'history-item-active':
              item.session_id === chatService.getActiveHistorySessionId,
          }"
          :aria-current="
            item.session_id === chatService.getActiveHistorySessionId
              ? 'true'
              : undefined
          "
          @click="selectHistory(item.id as string)"
        >
          <MessageOutlined />
          {{ item.preview }}
        </a-list-item>
      </a-list>
    </div>
    <div class="agent-tool-user">
      <AgentUser />
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { CloseOutlined, MessageOutlined } from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import AgentUser from "@view/components/agent-user.vue";
import AgentKnowledge from "@view/components/agent-knowledge.vue";
import { useChatStore } from "@view/stores/chat";
import type { HistoryInterface } from "@view/interfaces/history-interface";
import { createChatSession } from "@view/utils/random";
import { useRouter } from "vue-router";
import httpClient from "@view/services/http";
import { createChatLocation } from "@view/utils/chat-route";

const { useToken } = theme;
const { token } = useToken();
const router = useRouter();

const chatService = useChatStore();
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
  chatService.resetWorkspacePanel();
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

const newConversation = () => {
  router.push(createChatLocation(chatService.getAgentDetail?.agentCode));
  chatService.setAgentHistoryDetail([]);
  const nextSessionId = createChatSession();
  chatService.setActiveHistorySession("");
  chatService.setNewConversation(nextSessionId);
};

watch(
  () => chatService.getAgentDetail?.agentCode,
  () => {
    if (!chatService.getAgentDetail?.agentCode) return;
    getAgentHistoryList();
  },
  { flush: "sync" },
);

watch(
  () => chatService.getHistoryRefreshVersion,
  () => {
    if (!chatService.getAgentDetail?.agentCode) return;
    getAgentHistoryList();
  },
);

onMounted(() => {
  if (chatService.getAgentTool && chatService.getAgentDetail.agentCode) {
    getAgentHistoryList();
  }
});
</script>
<style scoped lang="less">
.agent-tool {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 10px;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-shell);
  color: var(--app-text);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);
}

.mobile-close {
  display: none;
}

.agent-header {
  min-height: 70px;
  flex: 0 0 70px;
  display: flex;
  align-items: center;
}

.brand-button {
  width: 100%;
  min-height: 54px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 7px 9px;
  border: 0;
  border-radius: 16px;
  color: inherit;
  text-align: left;
  background: transparent;
  cursor: pointer;
  transition:
    background 180ms ease,
    transform 180ms ease;

  &:hover {
    background: var(--app-primary-soft);
  }

  &:active {
    transform: scale(0.98);
  }

  > span:last-child {
    display: flex;
    min-width: 0;
    flex-direction: column;
    line-height: 1.25;
  }

  strong {
    color: var(--app-text);
    font-size: 18px;
    letter-spacing: -0.02em;
  }

  small {
    margin-top: 2px;
    color: var(--app-text-tertiary);
    font-size: 11px;
  }
}

.brand-mark {
  width: 38px;
  height: 38px;
  display: grid;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 13px 13px 13px 6px;
  color: #fff;
  background: linear-gradient(145deg, var(--app-primary), #9288f5);
  box-shadow: 0 4px 10px rgba(113, 103, 232, 0.2);
}

.agent-history-list {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .history-list-title {
    display: inline-flex;
    min-height: 36px;
    align-items: center;
    padding: 0 10px;
    border-radius: var(--app-radius-pill);
    color: var(--app-text-secondary);
    font-size: 12px;
    font-weight: 750;
    cursor: pointer;

    &:hover,
    &.router-link-active {
      color: var(--app-primary);
      background: var(--app-primary-soft);
    }
  }

  .ant-list {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :deep(.ant-list-header) {
    padding: 8px 0 4px;
    border: none;
  }

  :deep(.ant-spin-nested-loading) {
    display: inline-block;
    flex: 1;
    min-height: 0;
    padding: 0 4px;
    overflow-y: scroll;
  }
}

.ant-list-item {
  border: none;
  min-height: 42px;
  gap: 8px;
  margin: 2px 0;
  padding: 8px 10px;
  border-radius: 13px;
  color: var(--app-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition:
    color 180ms ease,
    background 180ms ease,
    transform 180ms ease;

  &:hover {
    color: var(--app-primary);
    background: var(--app-primary-soft);
    transform: translateX(2px);
  }

  &.history-item-active {
    color: var(--app-primary);
    font-weight: 720;
    background: var(--app-primary-soft);
    box-shadow: inset 3px 0 0 var(--app-primary);
  }
}

.agent-tool-user {
  min-height: 64px;
  flex: 0 0 64px;
  margin-top: 8px;
  padding-top: 8px;
  border-block-start: 1px solid var(--app-border-subtle);
}

@media (max-width: 768px) {
  .mobile-close {
    position: absolute;
    z-index: 3;
    top: 12px;
    right: 12px;
    width: 44px;
    height: 44px;
    display: grid;
    padding: 0;
    place-items: center;
    border: 1px solid var(--app-border-subtle);
    border-radius: var(--app-radius-pill);
    color: var(--app-text-secondary);
    background: var(--app-surface-soft);
    cursor: pointer;

    &:active {
      transform: scale(0.96);
    }
  }

  .brand-button {
    padding-right: 52px;
  }
}
</style>
