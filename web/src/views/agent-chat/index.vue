<template>
  <div
    class="agent-chat"
    :style="{
      '--color-text-tertiary': token.colorTextTertiary,
      '--color-bg': token.colorFillQuaternary,
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

            <ACollapse
              v-if="
                item.role === 'assistant' &&
                chatService.getAgentDetail?.supportThink &&
                item.thinkMessage
              "
              :bordered="false"
              accordion
            >
              <a-collapse-panel>
                <template #header>
                  <template v-if="item.thinking">
                    <SyncOutlined spin />
                    思考中···
                  </template>
                  <template v-else> 深度思考 </template>
                </template>
                <a-typography>
                  <div v-html="renderMarkdown(item.thinkMessage)"></div>
                </a-typography>
              </a-collapse-panel>
            </ACollapse>
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
import { useChatStore } from "@view/stores/chat";
import { renderMarkdown } from "@view/utils/typewriter";
import { createChatSession } from "@view/utils/random";
import { saveDocx } from "@view/utils/save-file";
import { copyToClipboard } from "@view/utils/copy";
import { AgentChat, KnowledgeDoc } from "@view/interfaces/agent-interface";
import {
  getFileExtUpper,
  isImageFile,
  splitUrlToFileArr,
} from "@view/utils/file";

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
  sendMessage(input, item.files, item.thinking, item?.knowledgeSkill);
};

const stopMessage = () => {
  if (!answer.value.length) return;
  answer.value[answer.value.length - 1].loading = false;
  answer.value[answer.value.length - 1]?.signal?.abort();
  answer.value[answer.value.length - 1].content =
    answer.value[answer.value.length - 1].content ?? "请求中断";
  answer.value[answer.value.length - 1].complete = true;
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
      }),
      signal: answer.value[answer.value.length - 1]?.signal?.signal,
    });

    // 2. 获取流读取器
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    await nextTick();

    // 3. 循环读取流
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      const messages = chunk.split("\n\n").filter(Boolean);

      for (const message of messages) {
        if (message.startsWith("data: ")) {
          const rawData = message.substring(6);

          if (rawData === "[DONE]") continue;

          try {
            const parsed = JSON.parse(rawData);
            console.log(parsed);
            if (parsed.done) {
              continue;
            }
            if (parsed?.thinking && parsed?.thinkMessage) {
              answer.value[answer.value.length - 1].thinkMessage +=
                parsed.thinkMessage;
            }
            if (parsed?.knowledge) {
              answer.value[answer.value.length - 1].knowledge =
                parsed.knowledge;
            }
            if (parsed.content) {
              answer.value[answer.value.length - 1].thinking = false;
              answer.value[answer.value.length - 1].collapse = "";
              answer.value[answer.value.length - 1].loading = false;
              answer.value[answer.value.length - 1].content += parsed.content;
            }
          } catch (err) {
            console.warn("Failed to parse SSE message:", rawData, err);
          }
        }
      }
    }
    answer.value[answer.value.length - 1].thinking = false;
    answer.value[answer.value.length - 1].loading = false;
    answer.value[answer.value.length - 1].complete = true;
  } catch (err) {
    answer.value[answer.value.length - 1].thinking = false;
    answer.value[answer.value.length - 1].loading = false;
    answer.value[answer.value.length - 1].complete = true;
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
    answer.value = chatService.getAgentHistoryDetail as unknown as AgentChat[];
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
</style>
