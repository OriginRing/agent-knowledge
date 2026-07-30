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
      '--gpt-vis-bg-container': token.colorBgContainer,
      '--gpt-vis-bg-elevated': token.colorBgElevated,
      '--gpt-vis-bg-hover': token.colorFillSecondary,
      '--gpt-vis-text': token.colorText,
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
              <div
                v-for="(file, index) in splitUrlToFileArr(item.files)"
                :key="index"
                @click="previewFile(file)"
              >
                <a-flex class="file-box" gap="8">
                  <FileIcon :name="file.name" class="file-icon" />
                  <a-flex vertical gap="8" justify="center">
                    <p>{{ file.name }}</p>
                    <span>{{ getFileExtUpper(file.name) }}</span>
                  </a-flex>
                </a-flex>
              </div>
            </a-flex>

            <ChatThoughtChain
              v-if="item.role === 'assistant'"
              :nodes="item.nodes"
              :active="item.status === 'running' && item.complete === false"
              :message-status="item.status"
            />
          </template>
          <template #message="{ item }">
            <p
              v-if="item.role !== 'assistant'"
              :class="[
                'chat-content',
                item.role === 'user' ? 'user-message' : 'system-message',
              ]"
            >
              {{ item.content }}
            </p>
            <a-typography v-else :id="item.key">
              <div
                class="chat-content markdown-body assistant-message"
                v-html="renderMarkdown(item.content)"
              ></div>
            </a-typography>
          </template>
          <template #footer="{ item }">
            <a-flex vertical gap="middle">
              <a-flex
                v-if="item.role === 'assistant' && item?.knowledge?.length"
              >
                <a-button
                  shape="round"
                  size="small"
                  @click="previewKnowledgeFile(item)"
                >
                  {{ knowledgeLength(item?.knowledge) }} 篇资料
                </a-button>
              </a-flex>
              <a-flex
                v-if="item.role !== 'system'"
                class="message-actions"
                align="center"
                gap="small"
              >
                <a-button
                  type="text"
                  size="small"
                  aria-label="复制消息"
                  @click="copyToClipboard(item.content)"
                >
                  <CopyOutlined />
                </a-button>
                <a-button
                  v-if="item.role === 'assistant' && getLastChat(item.key)"
                  type="text"
                  size="small"
                  aria-label="重新生成"
                  @click="regenerateChat(item)"
                >
                  <SyncOutlined />
                </a-button>
                <a-button
                  v-if="
                    item.role === 'assistant' &&
                    chatService.getAgentDetail?.supportDownload
                  "
                  type="text"
                  size="small"
                  aria-label="下载回答"
                  @click="downloadChat(item.key)"
                >
                  <DownloadOutlined />
                </a-button>
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
import { getFileExtUpper, splitUrlToFileArr } from "@view/utils/file";
import { createSseParser, upsertChatNode } from "@view/utils/sse";
import { rehydrateHistoryMessages } from "@view/utils/chat-state";
import {
  mergeReasoningIntoModelNode,
  openGeneratedFilePreview,
} from "@view/utils/thought-chain";
import FileIcon from "@view/components/file-icon.vue";

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

const previewFile = (file: { name: string; url: string }) => {
  console.log(1);
  openGeneratedFilePreview(
    {
      fileUrl: file.url,
      fileName: file.name,
    },
    chatService,
  );
};

const previewKnowledgeFile = (item: AgentChat) => {
  chatService.setAgentPreview(true);
  chatService.setAgentTool(false);
  chatService.setAgentPreviewFile(null);
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
    if (
      answer.value[answer.value.length - 1].status === "complete" &&
      sessionId.value
    ) {
      chatService.refreshHistory(sessionId.value);
    }
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
  padding: 0 36px 20px;

  .agent-content {
    flex: 1;
    height: 0;
    overflow: hidden;

    .chat {
      padding: 18px 4px 10px;
      height: 100%;
      overflow: hidden;
    }

    :deep(.ant-bubble-list) {
      height: 100%;
      padding-inline: 4px;
    }

    :deep(.ant-bubble-content) {
      padding: 0;
      border: 0;
      border-radius: 20px;
      background: transparent;
      box-shadow: none;
    }

    :deep(.ant-bubble-end .ant-bubble-content) {
      overflow: hidden;
      border-radius: 20px 20px 7px 20px;
      color: #fff;
      background: linear-gradient(145deg, var(--app-primary), #8e83f2);
      box-shadow: 0 4px 12px rgba(113, 103, 232, 0.18);
    }

    :deep(.ant-bubble-start .ant-bubble-content-filled) {
      border: 1px solid var(--app-border-subtle);
      border-radius: 20px 20px 20px 7px;
      color: var(--app-text);
      background: var(--app-surface-solid);
      box-shadow: var(--app-shadow-soft);
    }

    :deep(.ant-bubble-dot) {
      padding: 12px 16px;
      color: var(--app-primary);
    }
  }

  .agent-input {
    flex: 0 0 200px;
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
  padding: 10px;
  border: 1px solid var(--app-border-subtle);
  background: var(--app-surface-soft);
  border-radius: 16px;
  max-width: 180px;
  min-width: 160px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: var(--app-shadow-soft);
  transition:
    border-color 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: var(--app-primary);
    transform: translateY(-1px);
  }

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
    display: flex;
    align-items: center;
    justify-content: center;
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
  padding: 13px 17px;
  height: 100%;
  line-height: 1.65;
}

.assistant-message {
  min-width: min(560px, 62vw);
  color: var(--app-text);
  background: var(--app-surface-solid);
}

.user-message {
  color: #fff;
}

.system-message {
  color: var(--app-text-secondary);
  background: var(--app-mint-soft);
}

.message-actions {
  opacity: 0.68;
  transition: opacity 180ms ease;

  &:hover,
  &:focus-within {
    opacity: 1;
  }

  :deep(.ant-btn) {
    min-width: 36px;
    min-height: 36px;
    color: var(--app-text-tertiary);
  }
}

.markdown-body {
  color: var(--app-text);
  background: transparent;

  :deep(thead) {
    th {
      white-space: nowrap;
    }
  }
}

@media (max-width: 768px) {
  .agent-chat {
    padding: 0 10px 10px;

    .agent-input {
      flex-basis: 174px;
    }
  }

  .assistant-message {
    min-width: 0;
  }
}
</style>
