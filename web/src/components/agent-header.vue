<template>
  <div class="agent-header">
    <a-flex align="center" gap="middle">
      <h1 v-if="!historyView" class="log" @click="newConversation">Ollama</h1>
      <a-button
        v-if="historyView"
        class="menu"
        type="text"
        aria-label="收起侧栏"
        @click="historyHandle(false)"
      >
        <MenuFoldOutlined />
      </a-button>
      <a-button
        v-else
        type="text"
        class="menu"
        aria-label="展开侧栏"
        @click="historyHandle(true)"
      >
        <MenuUnfoldOutlined />
      </a-button>
      <a-button
        class="new-chat"
        type="default"
        shape="round"
        aria-label="新建对话"
        @click="newConversation"
      >
        <template #icon>
          <FormOutlined />
        </template>
      </a-button>
    </a-flex>

    <a-flex v-if="isChatPage" class="chat-title" align="center" vertical>
      <h3 v-if="!history.length">新对话</h3>
      <h3 v-else>{{ history[0]?.content || "" }}</h3>
    </a-flex>

    <a-flex v-if="isHistoryPage" align="center" vertical>
      <h3>管理对话</h3>
    </a-flex>
    <div class="header-actions">
      <GlassMagnifier />
      <AppUpdateButton />
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  FormOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons-vue";
import { useChatStore } from "@view/stores/chat";
import { AgentChat, AgentDetail } from "@view/interfaces/agent-interface";
import { createChatSession } from "@view/utils/random";
import httpClient from "@view/services/http";
import AppUpdateButton from "@view/components/app-update-button.vue";
import GlassMagnifier from "@view/components/glass-magnifier.vue";
import {
  CHAT_PATH,
  createChatLocation,
  getChatQueryValue,
  isHistoryForChatRoute,
  resolveChatAgent,
} from "@view/utils/chat-route";

const chatService = useChatStore();
const router = useRouter();
const route = useRoute();

const listAgent = ref<AgentDetail[]>([]);
const historyView = ref(true);
const history = ref<AgentChat[]>([]);

const isChatPage = computed(() => route.name === "Chat");
const isHistoryPage = computed(() => route.name === "History");

const historyHandle = (visible: boolean) => {
  historyView.value = visible;
  chatService.setAgentTool(visible);
};

const newConversation = () => {
  router.push(createChatLocation(chatService.getAgentDetail?.agentCode));
  chatService.setAgentHistoryDetail([]);
  const nextSessionId = createChatSession();
  chatService.setActiveHistorySession("");
  chatService.setNewConversation(nextSessionId);
};

let routeSyncVersion = 0;

const resetConversation = () => {
  chatService.setAgentHistoryDetail([]);
  chatService.setActiveHistorySession("");
  chatService.setNewConversation(createChatSession());
};

const syncChatRoute = async () => {
  if (route.path !== CHAT_PATH || !listAgent.value.length) return;

  const syncVersion = ++routeSyncVersion;
  const requestedAgentCode = getChatQueryValue(route.query.agendCode);
  const requestedSessionId = getChatQueryValue(route.query.session);
  const { agent: selectedAgent, invalid: hasInvalidAgent } = resolveChatAgent(
    listAgent.value,
    requestedAgentCode,
  );
  if (!selectedAgent) return;

  if (chatService.getAgentDetail?.agentCode !== selectedAgent.agentCode) {
    chatService.setAgentDetail(selectedAgent);
  }

  if (!requestedAgentCode || hasInvalidAgent) {
    await router.replace(
      createChatLocation(
        selectedAgent.agentCode,
        hasInvalidAgent ? undefined : requestedSessionId,
      ),
    );
    if (hasInvalidAgent) resetConversation();
    if (hasInvalidAgent || !requestedSessionId) return;
  }

  if (!requestedSessionId) {
    if (
      chatService.getActiveHistorySessionId ||
      chatService.getAgentHistoryDetail.length
    ) {
      resetConversation();
    }
    return;
  }

  if (
    chatService.getActiveHistorySessionId === requestedSessionId &&
    chatService.getAgentHistoryDetail.length
  ) {
    return;
  }

  chatService.resetWorkspacePanel();
  const res = await httpClient.post("/auth/history/detail", {
    sessionId: requestedSessionId,
  });
  if (syncVersion !== routeSyncVersion) return;

  if (
    res.code === 0 &&
    isHistoryForChatRoute(res.data, requestedSessionId, selectedAgent.agentCode)
  ) {
    chatService.setActiveHistorySession(requestedSessionId);
    chatService.setNewConversation(requestedSessionId);
    chatService.setAgentHistoryDetail(res.data.records || []);
    return;
  }

  resetConversation();
  await router.replace(createChatLocation(selectedAgent.agentCode));
};

const getAgentList = async () => {
  const res = await httpClient.get("/agent/list");
  if (res.code === 0) {
    listAgent.value = res.data || [];
    chatService.setAgentList(listAgent.value);
    const defaultAgent =
      listAgent.value.find((item) => item.default) || listAgent.value[0];
    if (defaultAgent) {
      if (route.path === CHAT_PATH) {
        await syncChatRoute();
      } else {
        chatService.setAgentDetail(defaultAgent);
      }
    }
  } else {
    listAgent.value = [];
    chatService.setAgentList([]);
  }
};

watch(
  () => route.fullPath,
  () => {
    syncChatRoute();
  },
);

watchEffect(() => {
  history.value = chatService.getAgentHistoryDetail as unknown as AgentChat[];
});

watchEffect(() => {
  historyView.value = chatService.getAgentTool;
});

onMounted(() => {
  getAgentList();
});
</script>
<style scoped lang="less">
.agent-header {
  height: 100%;
  display: flex;
  align-items: center;
  position: relative;
  justify-content: space-between;
  color: var(--app-text);

  .log {
    font-weight: 600;
    cursor: pointer;
  }

  .menu {
    position: static;
    z-index: 1;

    &:hover {
      background-color: var(--app-primary-soft);
    }
  }

  .new-chat {
    border-color: var(--app-border-subtle);
    background: var(--app-surface-soft);
  }

  .header-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
  }

  .chat-title {
    max-width: 40%;
    overflow: hidden;

    h3 {
      width: 100%;
      color: var(--app-text);
      font-size: 15px;
      font-weight: 720;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

@media (max-width: 768px) {
  .agent-header {
    .log {
      display: none;
    }

    .menu {
      position: static;
    }

    :deep(.ant-flex:first-child) {
      gap: 8px !important;
    }

    .chat-title {
      display: none;
    }
  }
}
</style>
