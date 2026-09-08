<template>
  <div class="agent-user">
    <a-dropdown
      placement="topLeft"
      trigger="click"
      overlay-class-name="app-user-menu"
    >
      <template #overlay>
        <a-menu>
          <a-menu-item @click="settingsOpen = true">
            <a-flex align="center" gap="small">
              <SettingOutlined />
              设置
            </a-flex>
          </a-menu-item>
          <a-menu-divider />
          <a-menu-item @click.stop="remove">
            <a-flex align="center" gap="small">
              <LogoutOutlined />
              退出登录
            </a-flex>
          </a-menu-item>
        </a-menu>
      </template>
      <button
        class="agent-use-info"
        type="button"
        :disabled="!chatService.getTokenStatus"
        aria-label="打开用户菜单"
      >
        <a-avatar :size="36" :src="user.avatar || undefined">
          <template #icon><UserOutlined /></template>
        </a-avatar>
        <div v-if="chatService.getTokenStatus" class="user-name">
          {{ user.nickname || user.username }}
        </div>
        <div v-else class="user-name">未登录</div>
        <SettingOutlined />
      </button>
    </a-dropdown>
  </div>

  <SettingsModal v-model:open="settingsOpen" />
</template>

<script setup lang="ts">
import { ref, watchEffect } from "vue";
import {
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { clearChatStore, useChatStore } from "@view/stores/chat";
import httpClient from "@view/services/http";
import type { UserInterface } from "@view/interfaces/user-interface";
import SettingsModal from "@view/components/settings-modal.vue";

const chatService = useChatStore();
const user = ref<Partial<UserInterface>>({});
const settingsOpen = ref(false);

const remove = async () => {
  const res = await httpClient.get("/auth/logout");
  if (res.code === 0) clearChatStore();
};

watchEffect(() => {
  user.value = chatService.getUserDetail;
});
</script>

<style scoped lang="less">
.agent-user {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-use-info {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 5px 8px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: inherit;
  background: transparent;
  border-radius: 15px;
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;

  &:not(:disabled):hover {
    border-color: var(--app-border-subtle);
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }

  &:disabled {
    cursor: default;
    opacity: 0.68;
  }

  :deep(.ant-avatar) {
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }
}

.user-name {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.app-user-menu .ant-dropdown-menu) {
  min-width: 210px;
  padding: 8px;
  border: 1px solid var(--app-border-subtle);
  border-radius: 18px;
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-float);
}

:global(.app-user-menu .ant-dropdown-menu-item) {
  min-height: 44px;
  border-radius: 12px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
