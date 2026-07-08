<template>
  <div
    class="agent-tool"
    :style="{
      '--color-bg-layout': token.colorBorder,
      '--color-bg-border': token.colorSplit,
    }"
  >
    <div class="agent-header">
      <h1 class="log" @click="newConversation">Ollama</h1>
    </div>
    <div class="agent-action">
      <AgentKnowledge />
    </div>
    <div class="agent-history-list">
      <a-list :locale="{ emptyText: '暂无数据' }">
        <template #header>
          <router-link class="history-list-title" to="/history"
            >历史对话</router-link
          >
        </template>
        <a-list-item
          v-for="item in historyList"
          :key="item.id"
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
import { MessageOutlined } from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import AgentUser from "@view/components/agent-user.vue";
import AgentKnowledge from "@view/components/agent-knowledge.vue";
import { debounce } from "lodash-es";
import { useChatStore } from "@view/stores/chat";
import type { HistoryInterface } from "@view/interfaces/history-interface";
import { createChatSession } from "@view/utils/random";
import { useRouter } from "vue-router";
import httpClient from "@view/services/http";

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
  const res = await httpClient.post("/auth/history/detail", {
    id: key,
  });
  if (res.code === 0) {
    const history = res.data;
    chatService.setNewConversation(history.session_id);
    chatService.setAgentHistoryDetail(history.records);
  } else {
    chatService.setAgentHistoryDetail([]);
  }
};

const debouncedGetHistory = debounce(getAgentHistoryList, 1000, {
  leading: true,
  trailing: false,
});

const newConversation = () => {
  if (router.currentRoute.value.path !== "/") {
    router.push("/");
  }
  chatService.setAgentHistoryDetail([]);
  chatService.setNewConversation(createChatSession());
};

watch(
  [
    () => chatService.getAgentDetail?.agentCode,
    () => chatService.getNewConversation,
  ],
  () => {
    if (!chatService.getAgentDetail?.agentCode) return;
    debouncedGetHistory();
  },
  { flush: "sync" },
);

onMounted(() => {
  if (chatService.getAgentTool && chatService.getAgentDetail.agentCode) {
    getAgentHistoryList();
  }
});
</script>
<style scoped lang="less">
.agent-tool {
  border-right: 1px solid var(--color-bg-border);
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0 8px;
  overflow: hidden;
}

.agent-header {
  height: 64px;
  flex: 0 0 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.agent-history-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.history-list-title {
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  color: inherit;
}

.ant-list {
  height: 100%;
  overflow: hidden;
}

:deep(.ant-list-header) {
  border: none;
}

:deep(.ant-spin-nested-loading) {
  height: calc(100% - 47px);
  overflow: scroll;
}

.ant-list-item {
  border: none;
  padding: 8px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-layout);
    border-radius: 8px;
  }
}

.agent-tool-user {
  border-block-start: 1px solid var(--color-bg-border);
  height: 64px;
  flex: 0 0 64px;
}
</style>
