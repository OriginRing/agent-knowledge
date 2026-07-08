<template>
  <div class="agent-user">
    <div class="agent-use-info">
      <a-avatar :size="36">
        <template #icon><UserOutlined /></template>
      </a-avatar>
      <div v-if="chatService.getTokenStatus" class="user-name">
        {{ user.nickname || user.username }}
      </div>
      <div v-else class="user-name">未登录</div>
    </div>
    <a-button
      v-if="chatService.getTokenStatus"
      type="default"
      shape="round"
      size="small"
      @click="remove"
      >退出</a-button
    >
  </div>
</template>
<script setup lang="ts">
import { UserOutlined } from "@ant-design/icons-vue";
import { clearChatStore, useChatStore } from "@view/stores/chat";
import { ref, watchEffect } from "vue";
import httpClient from "@view/services/http";
import type { UserInterface } from "@view/interfaces/user-interface";

const chatService = useChatStore();

const user = ref<Partial<UserInterface>>({});

const remove = async () => {
  const res = await httpClient.get("/auth/logout");
  if (res.code === 0) {
    clearChatStore();
  }
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
  display: flex;
  align-items: center;
  gap: 4px;
  overflow: hidden;

  .ant-avatar {
    flex: 0 0 36px;
  }

  .user-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
