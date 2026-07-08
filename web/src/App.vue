<script setup lang="ts">
import AgentHeader from "@view/components/agent-header.vue";
import AgentTool from "@view/views/agent-tool/index.vue";
import Login from "@view/views/login/index.vue";
import { computed, onMounted, ref, watch } from "vue";
import { theme } from "ant-design-vue";
import { useThemeStore } from "@view/stores/theme";
import { useChatStore } from "@view/stores/chat";
import Split from "@view/components/split.vue";
import KnowledgeFile from "@view/views/knowledge-file/index.vue";

const { useToken } = theme;
const { token } = useToken();

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

onMounted(() => applyTheme(themeStore.isDark));

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
</style>
