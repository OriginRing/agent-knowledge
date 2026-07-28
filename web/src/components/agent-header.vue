<template>
  <div class="agent-header">
    <a-flex align="center" gap="middle">
      <h1 v-if="!historyView" class="log" @click="newConversation">Ollama</h1>
      <a-button
        v-if="historyView"
        class="menu"
        type="text"
        @click="historyHandle(false)"
      >
        <MenuFoldOutlined />
      </a-button>
      <a-button v-else type="text" class="menu" @click="historyHandle(true)">
        <MenuUnfoldOutlined />
      </a-button>
      <a-button type="default" shape="round" @click="newConversation">
        <template #icon>
          <FormOutlined />
        </template>
      </a-button>
      <a-select
        v-model:value="agentMode"
        style="width: 120px"
        @change="selectAgent"
      >
        <a-select-option
          v-for="agent in listAgent"
          :key="agent.agentCode"
          :value="agent.agentCode"
          >{{ agent.agentName }}</a-select-option
        >
      </a-select>
    </a-flex>

    <a-flex v-if="isChatPage" class="chat-title" align="center" vertical>
      <h3 v-if="!history.length">新对话</h3>
      <h3 v-else>{{ history[0]?.content || "" }}</h3>
    </a-flex>

    <a-flex v-if="isHistoryPage" align="center" vertical>
      <h3>管理对话</h3>
    </a-flex>

    <a-flex align="center" gap="middle">
      <a-switch v-model:checked="themeSwitch" @change="changeTheme">
        <template #checkedChildren>
          <Iconfont type="icon-sunyardsun" />
        </template>
        <template #unCheckedChildren>
          <Iconfont type="icon-sunyarddark" />
        </template>
      </a-switch>
    </a-flex>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  FormOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons-vue";
import Iconfont from "@view/components/iconfont.vue";
import { useChatStore } from "@view/stores/chat";
import { useThemeStore } from "@view/stores/theme";
import { AgentChat, AgentDetail } from "@view/interfaces/agent-interface";
import { createChatSession } from "@view/utils/random";
import httpClient from "@view/services/http";

const chatService = useChatStore();
const themeService = useThemeStore();
const router = useRouter();
const route = useRoute();

const listAgent = ref<AgentDetail[]>([]);
const agentMode = ref("");
const themeSwitch = ref(true);
const historyView = ref(true);
const history = ref<AgentChat[]>([]);

const isChatPage = computed(() => route.name === "Chat");
const isHistoryPage = computed(() => route.name === "History");

const changeTheme = () => {
  themeService.setToggleDark(!themeSwitch.value);
};

const historyHandle = (visible: boolean) => {
  historyView.value = visible;
  chatService.setAgentTool(visible);
};

const newConversation = () => {
  if (router.currentRoute.value.path !== "/") {
    router.push("/");
  }
  chatService.setAgentHistoryDetail([]);
  chatService.setNewConversation(createChatSession());
};

const getAgentList = async () => {
  const res = await httpClient.get("/agent/list");
  if (res.code === 0) {
    listAgent.value = res.data || [];
    chatService.setAgentList(listAgent.value);
    agentMode.value =
      listAgent.value.find((item) => item.default)?.agentCode || "100001";
    selectAgent(agentMode.value);
  } else {
    listAgent.value = [];
  }
};

const selectAgent = (code: string) => {
  const agent = listAgent.value.find((item) => item.agentCode === code);
  chatService.setAgentDetail(agent as AgentDetail);
  chatService.setNewConversation(createChatSession());
  chatService.setAgentHistoryDetail([]);
};

watchEffect(() => {
  history.value = chatService.getAgentHistoryDetail as unknown as AgentChat[];
});

watchEffect(() => {
  historyView.value = chatService.getAgentTool;
});

onMounted(() => {
  getAgentList();
  themeSwitch.value = !themeService.getToggleDark;
});
</script>
<style scoped lang="less">
.agent-header {
  height: 100%;
  display: flex;
  align-items: center;
  position: relative;
  justify-content: space-between;

  .log {
    font-weight: 600;
    cursor: pointer;
  }

  .menu {
    position: absolute;
    z-index: 99;
    left: -60px;

    &:hover {
      background-color: transparent;
    }
  }

  .chat-title {
    max-width: 40%;
    overflow: hidden;

    h3 {
      width: 100%;
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

    .chat-title {
      display: none;
    }
  }
}
</style>
