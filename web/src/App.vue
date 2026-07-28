<script setup lang="ts">
import AgentHeader from "@view/components/agent-header.vue";
import AgentTool from "@view/views/agent-tool/index.vue";
import Login from "@view/views/login/index.vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { theme } from "ant-design-vue";
import { useThemeStore } from "@view/stores/theme";
import { useChatStore } from "@view/stores/chat";
import Split from "@view/components/split.vue";
import KnowledgeFile from "@view/views/knowledge-file/index.vue";
import { createChatSession } from "@view/utils/random";
import { useRouter } from "vue-router";

const { useToken } = theme;
const { token } = useToken();
const router = useRouter();

const themeStore = useThemeStore();
const chatService = useChatStore();
const historyView = ref(true);
const disable = computed(() => {
  return chatService.getAgentPreview ? null : "right";
});

const themeConfig = computed(() => ({
  algorithm: themeStore.isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
}));

const customStyle = computed(() => ({
  color: token.value.colorText,
}));

const customHeaderStyle = computed(() => ({
  background: token.value.colorBgContainer,
}));

watch(
  () => chatService.getAgentTool,
  () => {
    historyView.value = chatService.getAgentTool;
  },
);

const applyTheme = (dark: boolean) => {
  document.documentElement.classList.toggle("dark", dark);
};

const handleShortcut = (event: KeyboardEvent) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    if (router.currentRoute.value.path !== "/") {
      router.push("/");
    }
    chatService.setAgentHistoryDetail([]);
    chatService.setNewConversation(createChatSession());
  }
};

onMounted(() => {
  applyTheme(themeStore.isDark);
  window.addEventListener("keydown", handleShortcut);
  if (window.innerWidth <= 768) {
    chatService.setAgentTool(false);
    historyView.value = false;
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleShortcut);
});

watch(() => themeStore.isDark, applyTheme);
</script>
<template>
  <Login />
  <a-config-provider :theme="themeConfig">
    <Split value="0.5" :disable="disable" :min="0.2">
      <template #left>
        <a-layout :style="customStyle">
          <div :class="['left-wrapper', { 'left-collapsed': !historyView }]">
            <a-layout-sider :width="200">
              <AgentTool />
            </a-layout-sider>
          </div>
          <a-layout>
            <a-layout-header :style="customHeaderStyle">
              <AgentHeader />
            </a-layout-header>
            <a-layout-content>
              <router-view />
            </a-layout-content>
          </a-layout>
        </a-layout>
      </template>
      <template #right>
        <KnowledgeFile />
      </template>
    </Split>
  </a-config-provider>
</template>
<style lang="less" scoped>
.ant-layout {
  height: 100%;

  .left-wrapper {
    height: 100%;
    width: 200px;
    flex-shrink: 0;
    overflow: hidden;
    transition:
      width 0.3s ease,
      opacity 0.3s ease;
    opacity: 1;

    &.left-collapsed {
      width: 0;
      opacity: 0;
    }
  }

  .ant-layout-sider {
    background-color: transparent;
    height: 100%;
  }
}

@media (max-width: 768px) {
  .ant-layout {
    .left-wrapper {
      position: fixed;
      inset: 0 auto 0 0;
      z-index: 100;
      width: min(280px, 82vw);
      background: v-bind("token.colorBgContainer");
      box-shadow: 8px 0 24px rgba(0, 0, 0, 0.14);

      &.left-collapsed {
        width: 0;
        box-shadow: none;
      }
    }

    .ant-layout-sider {
      width: min(280px, 82vw) !important;
      max-width: min(280px, 82vw) !important;
    }
  }
}
</style>
