<template>
  <a-list
    :style="{
      '--color-bg-layout': token.colorBorder,
    }"
  >
    <a-list-item key="1" @click="newConversation">
      <a-flex gap="large">
        <span>
          <FormOutlined />
          新对话
        </span>
        <kbd>⌘ K</kbd>
      </a-flex>
    </a-list-item>
    <a-list-item key="4">
      <router-link class="memory" to="/memory">
        <SearchOutlined />
        个人记忆
      </router-link>
    </a-list-item>
  </a-list>
</template>
<script setup lang="ts">
import { SearchOutlined, FormOutlined } from "@ant-design/icons-vue";
import { theme } from "ant-design-vue";
import { useChatStore } from "@view/stores/chat";
import { createChatSession } from "@view/utils/random";
import { createChatLocation } from "@view/utils/chat-route";
import { useRouter } from "vue-router";

const { useToken } = theme;
const { token } = useToken();
const router = useRouter();
const chatService = useChatStore();
const newConversation = () => {
  router.push(createChatLocation(chatService.getAgentDetail?.agentCode));
  chatService.setAgentHistoryDetail([]);
  const nextSessionId = createChatSession();
  chatService.setActiveHistorySession("");
  chatService.setNewConversation(nextSessionId);
};
</script>
<style scoped lang="less">
:deep(.ant-list) {
  display: grid;
  gap: 3px;
}

.ant-list-item {
  border: none;
  min-height: 44px;
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

  span {
    margin-right: 4px;
  }

  .memory {
    width: 100%;
    min-height: 28px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    color: inherit;

    &.router-link-active {
      color: var(--app-primary);
      font-weight: 700;
    }
  }

  :deep(.ant-flex) {
    width: 100%;
    justify-content: space-between;
  }

  kbd {
    padding: 2px 7px;
    border: 1px solid var(--app-border);
    border-radius: 8px;
    color: var(--app-text-tertiary);
    font: 11px/1.5 var(--mono);
    background: var(--app-surface-soft);
  }
}
</style>
