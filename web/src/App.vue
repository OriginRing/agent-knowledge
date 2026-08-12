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

const workspaceThemeConfig = computed(() => ({
  algorithm: themeStore.isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
  token: {
    colorPrimary: themeStore.isDark ? "#9f96ff" : "#7167e8",
    colorInfo: themeStore.isDark ? "#9f96ff" : "#7167e8",
    colorSuccess: themeStore.isDark ? "#72d8b5" : "#39a986",
    colorWarning: themeStore.isDark ? "#ffc18c" : "#df8749",
    colorBgLayout: themeStore.isDark ? "#171625" : "#f6f5ff",
    colorBgContainer: themeStore.backgroundImageUrl
      ? themeStore.isDark
        ? "rgba(36, 34, 56, 0.68)"
        : "rgba(255, 255, 255, 0.68)"
      : themeStore.isDark
        ? "#242238"
        : "#ffffff",
    colorBorder: themeStore.isDark ? "#3b3854" : "#e7e4f5",
    borderRadius: 14,
    borderRadiusLG: 18,
    borderRadiusSM: 10,
    controlHeight: 44,
    controlHeightLG: 48,
    controlHeightSM: 36,
    fontFamily:
      "ui-rounded, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow:
      "0 4px 12px rgba(74, 65, 135, 0.07), 0 1px 3px rgba(74, 65, 135, 0.04)",
    boxShadowSecondary:
      "0 10px 26px rgba(74, 65, 135, 0.14), 0 3px 8px rgba(74, 65, 135, 0.05)",
  },
  components: {
    Button: {
      borderRadius: 14,
      borderRadiusLG: 16,
      defaultShadow: "none",
      primaryShadow: "0 4px 10px rgba(113, 103, 232, 0.2)",
    },
    Card: {
      borderRadiusLG: 18,
      boxShadowTertiary: "0 4px 12px rgba(74, 65, 135, 0.07)",
    },
    Input: {
      activeShadow: "0 0 0 3px rgba(113, 103, 232, 0.14)",
    },
    Select: {
      optionSelectedBg: themeStore.isDark ? "#353151" : "#eeecff",
    },
    Modal: {
      borderRadiusLG: 24,
    },
  },
}));

const customStyle = computed(() => ({
  color: token.value.colorText,
}));

const workspaceStyle = computed(() => ({
  "--workspace-bg-image": themeStore.backgroundImageUrl
    ? `url("${themeStore.backgroundImageUrl}")`
    : "none",
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
    chatService.setActiveHistorySession("");
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
  <a-config-provider :theme="themeConfig">
    <Login />
    <a-config-provider :theme="workspaceThemeConfig">
      <Split
        :class="[
          'app-workspace',
          { 'has-background-image': themeStore.backgroundImageUrl },
        ]"
        :style="workspaceStyle"
        value="0.5"
        :disable="disable"
        :min="0.2"
      >
        <template #left>
          <a-layout class="workspace-layout" :style="customStyle">
            <div :class="['left-wrapper', { 'left-collapsed': !historyView }]">
              <a-layout-sider :width="216">
                <AgentTool />
              </a-layout-sider>
            </div>
            <button
              v-if="historyView"
              class="mobile-nav-scrim"
              type="button"
              aria-label="点击遮罩关闭侧栏"
              @click="chatService.setAgentTool(false)"
            />
            <a-layout class="workspace-main">
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
  </a-config-provider>
</template>
<style lang="less" scoped>
.ant-layout {
  height: 100%;
  min-width: 0;
  background: transparent;

  .left-wrapper {
    height: 100%;
    width: 216px;
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

.workspace-layout {
  gap: 14px;
  padding: 14px;
}

.mobile-nav-scrim {
  display: none;
}

.workspace-main {
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-shell);
  background: var(--app-surface);
  box-shadow: var(--app-shadow-soft);

  :deep(.ant-layout-header) {
    height: 70px;
    padding: 0 24px;
    line-height: normal;
    border-bottom: 1px solid var(--app-border-subtle);
    background: var(--app-surface) !important;
  }

  :deep(.ant-layout-content) {
    min-height: 0;
    overflow: hidden;
    background: transparent;
  }
}

@media (max-width: 768px) {
  .ant-layout {
    .left-wrapper {
      position: fixed;
      inset: 10px auto 10px 10px;
      z-index: 100;
      width: min(280px, 82vw);
      height: auto;
      border: 1px solid var(--app-border-subtle);
      border-radius: 22px;
      background: v-bind("token.colorBgContainer");
      box-shadow: var(--app-shadow-float);

      &.left-collapsed {
        width: 0;
        border-width: 0;
        box-shadow: none;
      }
    }

    .ant-layout-sider {
      width: min(280px, 82vw) !important;
      max-width: min(280px, 82vw) !important;
    }
  }

  .workspace-layout {
    gap: 0;
    padding: 8px;
  }

  .mobile-nav-scrim {
    position: fixed;
    z-index: 95;
    inset: 0;
    display: block;
    padding: 0;
    border: 0;
    background: rgba(40, 35, 68, 0.28);
    backdrop-filter: blur(2px);
  }

  .workspace-main {
    border-radius: 20px;

    :deep(.ant-layout-header) {
      height: 62px;
      padding: 0 14px;
    }
  }
}
</style>
