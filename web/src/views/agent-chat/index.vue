<template>
  <div
    class="agent-chat"
    :style="{
      '--color-text-tertiary': token.colorTextTertiary,
      '--color-bg': token.colorFillQuaternary,
      '--color-border-secondary': token.colorBorderSecondary,
      '--color-error': token.colorError,
      '--color-primary': token.colorPrimary,
      '--color-success': token.colorSuccess,
      '--color-warning': token.colorWarning,
    }"
  >
    <div class="agent-content">
      <div class="chat">
        <bubble-list
          :auto-scroll="true"
          :items="answer"
          :roles="roleConfig"
          :message-render="renderMarkdown"
        >
          <template #header="{ item }">
            <a-flex v-if="item.role === 'user'" vertical gap="8">
              <a-flex
                v-for="(file, index) in splitUrlToFileArr(item.files)"
                :key="index"
                class="file-box"
                gap="8"
              >
                <a-image
                  v-if="isImageFile(file.name)"
                  :width="50"
                  :height="50"
                  :src="file.url"
                  :alt="file.name"
                >
                </a-image>
                <FileTextOutlined
                  v-else
                  style="font-size: 50px"
                  class="file-icon"
                />
                <a-flex vertical gap="8" justify="center">
                  <p>{{ file.name }}</p>
                  <span>{{ getFileExtUpper(file.name) }}</span>
                </a-flex>
              </a-flex>
            </a-flex>

            <ChatThoughtChain
              v-if="item.role === 'assistant'"
              :nodes="item.nodes"
              :active="item.status === 'running' && item.complete === false"
              :message-status="item.status"
            />
          </template>
          <template #message="{ item }">
            <p v-if="item.role !== 'assistant'" class="chat-content">
              {{ item.content }}
            </p>
            <a-typography v-else :id="item.key">
              <div
                class="chat-content markdown-body"
                v-html="renderMarkdown(item.content)"
              ></div>
            </a-typography>
          </template>
          <template #footer="{ item }">
            <a-flex vertical gap="middle">
              <a-flex
                v-if="item.role === 'assistant' && item?.knowledge?.length"
              >
                <a-button shape="round" size="small" @click="previewFile(item)">
                  {{ knowledgeLength(item?.knowledge) }} 篇资料
                </a-button>
              </a-flex>
              <a-flex v-if="item.role !== 'system'" align="center" gap="middle">
                <CopyOutlined @click="copyToClipboard(item.content)" />
                <SyncOutlined
                  v-if="item.role === 'assistant' && getLastChat(item.key)"
                  @click="regenerateChat(item)"
                />
                <DownloadOutlined
                  v-if="
                    item.role === 'assistant' &&
                    chatService.getAgentDetail?.supportDownload
                  "
                  @click="downloadChat(item.key)"
                />
              </a-flex>
            </a-flex>
          </template>
        </bubble-list>
      </div>
    </div>
    <div class="agent-input">
      <ChatInput
        :support-stop="supportStop"
        @stop-message="stopMessage"
        @send-message="sendMessage"
      />
    </div>
  </div>
</template>
<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  reactive,
  ref,
  watch,
  watchEffect,
} from "vue";
import { BubbleList, theme } from "ant-design-x-vue";
import {
  CopyOutlined,
  SyncOutlined,
  DownloadOutlined,
  FileTextOutlined,
} from "@ant-design/icons-vue";
import ChatInput from "@view/components/chat-input.vue";
import ChatThoughtChain from "@view/components/chat-thought-chain.vue";
import { useChatStore } from "@view/stores/chat";
import { renderMarkdown } from "@view/utils/typewriter";
import { createChatSession } from "@view/utils/random";
import { saveDocx } from "@view/utils/save-file";
import { copyToClipboard } from "@view/utils/copy";
import type {
  AgentChat,
  ChatArtifact,
  ChatNode,
  KnowledgeDoc,
} from "@view/interfaces/agent-interface";
import {
  getFileExtUpper,
  isImageFile,
  splitUrlToFileArr,
} from "@view/utils/file";
import { createSseParser, upsertChatNode } from "@view/utils/sse";
import { rehydrateHistoryMessages } from "@view/utils/chat-state";
import { mergeReasoningIntoModelNode } from "@view/utils/thought-chain";

const { useToken } = theme;
const { token } = useToken();

const system: AgentChat = {
  key: "1",
  role: "system",
  content: "你好！我是 AI 助手，有什么可以帮你？",
};

const answer = ref<AgentChat[]>([system]);
const sessionId = ref<string>("");
const chatService = useChatStore();

const roleConfig = reactive({
  user: {
    placement: "end" as const, // 靠右
    variant: "outlined" as const,
  },
  assistant: {
    placement: "start" as const, // 靠左
    variant: "filled" as const,
  },
  system: {
    placement: "start" as const, // 靠左
    variant: "filled" as const,
  },
});

const knowledgeLength = (list: KnowledgeDoc[] = []) => {
  const uniqueFileIds = new Set(list.map((doc) => doc.fileId));
  return uniqueFileIds.size;
};

const getLastChat = (key: string) => {
  return (
    answer.value.findIndex((v) => v.key === key) === answer.value.length - 1
  );
};

const supportStop = computed(() => {
  return (
    answer.value.at(-1)?.role === "assistant" &&
    answer.value.at(-1)?.complete === false
  );
});

const previewFile = (item: AgentChat) => {
  chatService.setAgentPreview(true);
  chatService.setAgentTool(false);
  chatService.setAgentPreviewFiles(item.knowledge || []);
};

const regenerateChat = (item: AgentChat) => {
  const lastUserChat = answer.value.findLast((v) => v.role === "user");
  const input: string = lastUserChat?.content || "";
  sendMessage(
    input,
    lastUserChat?.files,
    item.thinking,
    item?.knowledgeSkill,
    item?.connectSkill,
  );
};

const stopMessage = () => {
  if (!answer.value.length) return;
  answer.value[answer.value.length - 1].loading = false;
  answer.value[answer.value.length - 1]?.signal?.abort();
  answer.value[answer.value.length - 1].content =
    answer.value[answer.value.length - 1].content ?? "请求中断";
  answer.value[answer.value.length - 1].complete = true;
  answer.value[answer.value.length - 1].status = "cancelled";
};

const sendMessage = async (
  input: string,
  fileList: string = "",
  thinking: boolean = false,
  knowledge: boolean = false,
  internet: boolean = false,
) => {
  if (!input && !fileList) return;
  const now = Date.now();
  answer.value.push({
    key: (now + 1).toString(),
    role: "user",
    content: input ? input : "帮我分析下文件内容",
    files: fileList,
  });
  answer.value.push({
    key: (now + 2).toString(),
    role: "assistant",
    content: "",
    loading: true,
    thinking: true,
    knowledgeSkill: knowledge,
    connectSkill: internet,
    thinkMessage: "",
    collapse: (now + 2).toString(),
    complete: false,
    signal: new AbortController(),
    nodes: [],
    artifacts: [],
    status: "running",
  });
  await nextTick();
  try {
    const response = await fetch("/agent/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: sessionId.value,
        thinking: chatService.getAgentDetail.supportThink && thinking,
        knowledge: chatService.getAgentDetail.supportKnowledge && knowledge,
        connect: chatService.getAgentDetail.supportConnect && internet,
        agentCode: chatService.getAgentDetail.agentCode,
        text: input ? input : "帮我分析下文件内容",
        files: fileList,
        skills: [
          ...(internet ? ["web-search"] : []),
          ...(knowledge ? ["knowledge-search"] : []),
        ],
      }),
      signal: answer.value[answer.value.length - 1]?.signal?.signal,
    });

    // 2. 获取流读取器
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    const parser = createSseParser();
    const assistantKey = (now + 2).toString();
    await nextTick();

    // 3. 循环读取流
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const events = parser.push(chunk) as Array<{
        event?: string;
        content?: string;
        thinkMessage?: string;
        knowledge?: KnowledgeDoc[];
        artifacts?: ChatArtifact[];
        node?: ChatNode;
        error?: string;
        done?: boolean;
        message?: AgentChat;
        sessionId?: string;
      }>;

      for (const parsed of events) {
        const assistant = answer.value.find(
          (item) => item.key === assistantKey,
        );
        if (!assistant) continue;
        if (parsed.node) {
          assistant.nodes = upsertChatNode(assistant.nodes ?? [], parsed.node);
        }
        if (parsed.thinkMessage) {
          assistant.thinkMessage =
            (assistant.thinkMessage ?? "") + parsed.thinkMessage;
          assistant.nodes = mergeReasoningIntoModelNode(
            assistant.nodes ?? [],
            assistant.thinkMessage,
          );
        }
        if (parsed.knowledge?.length) assistant.knowledge = parsed.knowledge;
        if (parsed.artifacts?.length) assistant.artifacts = parsed.artifacts;
        if (parsed.content) {
          assistant.thinking = false;
          assistant.collapse = "";
          assistant.loading = false;
          assistant.content += parsed.content;
        }
        if (parsed.error) {
          assistant.error = parsed.error;
          assistant.status = "error";
          assistant.loading = false;
          assistant.thinking = false;
        }
        if (parsed.done && parsed.message) {
          assistant.nodes = parsed.message.nodes ?? assistant.nodes;
          assistant.artifacts = parsed.message.artifacts ?? assistant.artifacts;
          assistant.knowledge = parsed.message.knowledge ?? assistant.knowledge;
          assistant.status = parsed.message.status ?? "complete";
          assistant.complete = true;
          if (parsed.sessionId) sessionId.value = parsed.sessionId;
        }
      }
    }
    answer.value[answer.value.length - 1].thinking = false;
    answer.value[answer.value.length - 1].loading = false;
    answer.value[answer.value.length - 1].complete = true;
    answer.value[answer.value.length - 1].status =
      answer.value[answer.value.length - 1].status === "error"
        ? "error"
        : "complete";
  } catch (err) {
    answer.value[answer.value.length - 1].thinking = false;
    answer.value[answer.value.length - 1].loading = false;
    answer.value[answer.value.length - 1].complete = true;
    answer.value[answer.value.length - 1].status = "error";
    console.error("流式请求失败：", err);
  }
};

const downloadChat = (index: string) => saveDocx(index);

watch(
  () => chatService.getNewConversation,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      answer.value = [system];
      sessionId.value = newVal;
    }
  },
);

watchEffect(() => {
  if (chatService.getAgentHistoryDetail.length) {
    answer.value = rehydrateHistoryMessages(chatService.getAgentHistoryDetail);
  }
});

onMounted(() => {
  sessionId.value = createChatSession();
});
</script>
<style scoped lang="less">
.agent-chat {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  height: 100%;
  padding: 0 48px 24px;

  .agent-content {
    flex: 1;
    height: 0;
    overflow: hidden;

    .chat {
      padding: 12px 0;
      height: 100%;
      overflow: hidden;
    }

    :deep(.ant-bubble-list) {
      height: 100%;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE */
    }

    :deep(.ant-bubble-content) {
      padding: 0;
    }

    :deep(.ant-bubble-dot) {
      padding: 12px 16px;
    }
  }

  .agent-input {
    flex: 0 0 190px;
    position: relative;

    .send {
      position: absolute;
      right: 12px;
      bottom: 32px;
    }
  }
}

.file-box {
  position: relative;
  padding: 8px;
  background-color: var(--color-bg);
  border-radius: 4px;
  max-width: 180px;
  min-width: 160px;
  overflow: hidden;

  :deep(.ant-image) {
    flex: 0 0 50px;
    width: 50px;
    height: 50px;
    overflow: hidden;
  }

  :deep(.ant-flex) {
    overflow: hidden;
  }

  .file-icon {
    width: 50px;
    flex: 0 0 50px;
  }

  p {
    font-size: 14px;
    line-height: 18px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    display: inline-block;
    color: var(--color-text-tertiary);
    font-size: 12px;
    line-height: 14px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.ant-typography {
  height: 100%;
}

.chat-content {
  padding: 12px 16px;
  height: 100%;
}

.markdown-body {
  :deep(thead) {
    th {
      white-space: nowrap;
    }
  }
}

@media (max-width: 768px) {
  .agent-chat {
    padding: 0 12px 12px;

    .agent-input {
      flex-basis: 170px;
    }
  }
}
</style>
