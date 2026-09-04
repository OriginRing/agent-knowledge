<template>
  <div
    class="agent-input"
    :style="{
      '--color-text-tertiary': token.colorTextTertiary,
      '--color-bg': token.colorFillQuaternary,
      '--color-bg-elevated': token.colorBgElevated,
    }"
  >
    <div
      v-if="mentionOpen"
      class="agent-mention-menu"
      role="listbox"
      aria-label="选择智能体"
    >
      <button
        v-for="(agent, index) in filteredAgents"
        :id="`agent-option-${agent.agentCode}`"
        :key="agent.agentCode"
        type="button"
        role="option"
        :aria-selected="index === activeAgentIndex"
        :class="[
          'agent-mention-option',
          { active: index === activeAgentIndex },
        ]"
        @mousedown.prevent="selectAgent(agent)"
      >
        <span class="agent-option-name">{{ agent.agentName }}</span>
        <span v-if="agent.description" class="agent-option-description">
          {{ agent.description }}
        </span>
      </button>
      <div v-if="!filteredAgents.length" class="agent-mention-empty">
        未找到匹配的智能体
      </div>
    </div>
    <div v-if="selectedAgent?.slot?.length" class="agent-slots">
      <button
        v-for="(slot, index) in selectedAgent.slot"
        :key="index"
        type="button"
        class="agent-slot-button"
        @click="applySlot(slot.content)"
      >
        {{ slot.title }}
      </button>
    </div>
    <Sender
      v-model:value="chatInput"
      placeholder="请输入..."
      :auto-size="{ minRows: 1, maxRows: 3 }"
      :actions="false"
      :components="senderComponents"
      :aria-activedescendant="activeDescendant"
      :aria-expanded="mentionOpen"
      aria-autocomplete="list"
      role="combobox"
      @blur="mentionOpen = false"
      @keydown="handleEnter"
    >
      <template #header>
        <div v-if="quoteContent" class="input-quote">
          <span class="input-quote-content">{{ quoteContent }}</span>
          <a-button
            type="text"
            size="small"
            class="input-quote-close"
            aria-label="移除引用"
            @click="clearQuote"
          >
            <CloseOutlined />
          </a-button>
        </div>
        <a-flex v-if="uploadFiles.length" class="input-file">
          <a-flex class="input-file-scroll" gap="12">
            <a-flex
              v-for="(file, index) in uploadFiles"
              :key="index"
              class="file-box-scroll"
              style="position: relative"
            >
              <div v-if="!file.loading && !file.url" class="file-error">
                <a-flex align="center" justify="center">
                  <ExclamationOutlined @click="refreshFile(file.file, index)" />
                </a-flex>
              </div>
              <a-spin :spinning="file.loading">
                <a-flex class="file-box" gap="8">
                  <CloseCircleOutlined
                    class="close"
                    @click="clearFile(index)"
                  />
                  <FileIcon :name="file.name" class="file-icon" />
                  <a-flex
                    vertical
                    gap="8"
                    justify="center"
                    style="overflow: hidden"
                  >
                    <p>{{ file.name }}</p>
                    <span
                      >{{ getFileExtUpper(file.name) }}·{{
                        formatFileSize(file.file.size)
                      }}</span
                    >
                  </a-flex>
                </a-flex>
              </a-spin>
            </a-flex>
          </a-flex>
        </a-flex>
      </template>
      <template #footer="{ info: { components } }">
        <a-flex justify="space-between" align="center">
          <a-flex class="input-tools" gap="small" align="center">
            <template v-if="chatService.getAgentDetail?.supportFile">
              <a-dropdown placement="topLeft" trigger="click">
                <a-button type="text" aria-label="添加附件">
                  <template #icon>
                    <PaperClipOutlined />
                  </template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item>
                      <a-upload
                        ref="imageUploadRef"
                        :show-upload-list="false"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/bmp,image/tiff"
                        :before-upload="handleImageBeforeUpload"
                      >
                        <a-flex justify="center">上传图片</a-flex>
                      </a-upload>
                    </a-menu-item>
                    <a-menu-item>
                      <a-upload
                        ref="fileUploadRef"
                        :show-upload-list="false"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.pptx,.ppt,.html,.htm,.ofd"
                        :before-upload="handleFileBeforeUpload"
                      >
                        <a-flex justify="center">上传文档</a-flex>
                      </a-upload>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <a-divider type="vertical" />
            </template>
            <template v-if="chatService.getAgentDetail?.supportThink">
              <span class="tool-label">深度思考</span>
              <a-switch
                v-model:checked="thinking"
                size="small"
                aria-label="切换深度思考"
              />
              <a-divider type="vertical" />
            </template>
            <template v-if="chatService.getAgentDetail?.supportKnowledge">
              <a-button
                :type="knowledge ? 'link' : 'text'"
                shape="circle"
                aria-label="连接知识库"
                @click="connectKnowledge"
              >
                <ApiOutlined />
              </a-button>
              <a-divider type="vertical" />
            </template>

            <a-button
              v-if="chatService.getAgentDetail?.supportConnect"
              :type="internet ? 'link' : 'text'"
              shape="circle"
              aria-label="连接互联网"
              @click="connectInternet"
            >
              <GlobalOutlined />
            </a-button>
            <div />
          </a-flex>
          <a-flex align="center">
            <component
              :is="components.SendButton"
              v-if="!supportStop"
              type="primary"
              @click="sendQuestion"
            />
            <component
              :is="components.LoadingButton"
              v-else
              type="primary"
              :disabled="false"
              @click="emit('stopMessage')"
            />
          </a-flex>
        </a-flex>
      </template>
    </Sender>
    <div class="agent-input-tip">AI 生成可能有误，请核实</div>
  </div>
</template>
<script lang="ts" setup>
import { computed, nextTick, provide, ref, shallowRef, watch } from "vue";
import {
  ApiOutlined,
  GlobalOutlined,
  PaperClipOutlined,
  CloseCircleOutlined,
  CloseOutlined,
  ExclamationOutlined,
} from "@ant-design/icons-vue";
import { Sender } from "ant-design-x-vue";
import { useChatStore } from "@view/stores/chat";
import { Input, message, theme } from "ant-design-vue";
import httpClient from "@view/services/http";
import { formatFileSize, getFileExtUpper, isImageFile } from "@view/utils/file";
import { createChatSession } from "@view/utils/random";
import FileIcon from "@view/components/file-icon.vue";
import AgentMentionInput from "./components/agent-mention-input.vue";
import {
  agentMentionKey,
  type AgentMentionEditorApi,
} from "./components/agent-mention-context";
import type { AgentDetail } from "@view/interfaces/agent-interface";

const emit = defineEmits(["stopMessage", "sendMessage"]);
const _props = defineProps({
  supportStop: Boolean,
});

const { useToken } = theme;
const { token } = useToken();
const senderComponents = {
  input: AgentMentionInput as unknown as typeof Input.TextArea,
};
const chatInput = ref<string>("");
const quoteContent = ref("");
const chatService = useChatStore();
const thinking = ref(false);
const internet = ref(false);
const knowledge = ref(false);
const uploadFiles = ref<
  Array<{
    file: File;
    name: string;
    url: string;
    loading: boolean;
    image?: string;
  }>
>([]);
const mentionOpen = ref(false);
const mentionQuery = ref("");
const mentionStart = ref(-1);
const activeAgentIndex = ref(0);
const mentionEditorApi = shallowRef<AgentMentionEditorApi>();

const selectedAgent = computed(() =>
  chatService.getAgentDetail?.agentCode
    ? chatService.getAgentDetail
    : undefined,
);

const defaultAgent = computed(
  () =>
    chatService.getAgentList.find((agent) => agent.default) ||
    chatService.getAgentList[0],
);

watch(
  [selectedAgent, defaultAgent],
  ([selected, fallback]) => {
    if (!selected && fallback) chatService.setAgentDetail(fallback);
  },
  { immediate: true },
);

const filteredAgents = computed(() => {
  const query = mentionQuery.value.trim().toLocaleLowerCase();
  if (!query) return chatService.getAgentList;
  return chatService.getAgentList.filter((agent) =>
    agent.agentName.toLocaleLowerCase().includes(query),
  );
});

const activeDescendant = computed(() => {
  if (!mentionOpen.value) return undefined;
  const agent = filteredAgents.value[activeAgentIndex.value];
  return agent ? `agent-option-${agent.agentCode}` : undefined;
});

watch(chatInput, (value) => {
  const match = value.match(/(?:^|\s)@([^@\s]*)$/);
  if (!match) {
    mentionOpen.value = false;
    mentionStart.value = -1;
    return;
  }
  mentionStart.value = value.lastIndexOf("@");
  mentionQuery.value = match[1] || "";
  activeAgentIndex.value = Math.max(
    0,
    filteredAgents.value.findIndex(
      (agent) => agent.agentCode === selectedAgent.value?.agentCode,
    ),
  );
  mentionOpen.value = true;
});

watch(filteredAgents, (agents) => {
  if (activeAgentIndex.value >= agents.length) activeAgentIndex.value = 0;
});

const selectAgent = (agent: AgentDetail) => {
  const changed = agent.agentCode !== selectedAgent.value?.agentCode;
  if (changed) emit("stopMessage");
  const triggerLength =
    mentionStart.value >= 0 ? chatInput.value.length - mentionStart.value : 0;
  mentionEditorApi.value?.insertMention(agent, triggerLength);
  chatService.setAgentDetail(agent);
  if (changed) {
    chatService.setNewConversation(createChatSession());
    chatService.setActiveHistorySession("");
    chatService.setAgentHistoryDetail([]);
  }
  mentionOpen.value = false;
  mentionStart.value = -1;
};

const applySlot = (content: string) => {
  mentionEditorApi.value?.insertSlot(content);
  mentionOpen.value = false;
};

watch(
  () => [selectedAgent.value?.agentCode, selectedAgent.value?.configVersion],
  () => {
    const agent = selectedAgent.value;
    thinking.value = Boolean(agent?.supportThink && agent.defaultThink);
    internet.value = Boolean(agent?.supportConnect && agent.defaultConnect);
    knowledge.value = Boolean(
      agent?.supportKnowledge && agent.defaultKnowledge,
    );
  },
  { immediate: true },
);

const clearAgent = () => {
  chatService.setAgentDetail(defaultAgent.value || ({} as AgentDetail));
  thinking.value = Boolean(
    defaultAgent.value?.supportThink && defaultAgent.value.defaultThink,
  );
  internet.value = Boolean(
    defaultAgent.value?.supportConnect && defaultAgent.value.defaultConnect,
  );
  knowledge.value = Boolean(
    defaultAgent.value?.supportKnowledge && defaultAgent.value.defaultKnowledge,
  );
};

provide(agentMentionKey, {
  selectedAgent,
  editorApi: mentionEditorApi,
  clearAgent,
});

const connectInternet = () => {
  internet.value = !internet.value;
};

const connectKnowledge = () => {
  knowledge.value = !knowledge.value;
};

const ensureAgentSelected = () => {
  if (selectedAgent.value) return true;
  if (defaultAgent.value) {
    chatService.setAgentDetail(defaultAgent.value);
    return true;
  }
  message.warning("暂无可用智能体");
  return false;
};

const setQuote = (content: string) => {
  quoteContent.value = content.trim();
};

const clearQuote = () => {
  quoteContent.value = "";
};

const getMessageContent = () =>
  [quoteContent.value, chatInput.value].filter(Boolean).join("\n\n");

const sendCurrentQuestion = () => {
  const content = getMessageContent();
  if (!content && !uploadFiles.value.length) return;
  if (!ensureAgentSelected()) return;
  emit(
    "sendMessage",
    content,
    uploadFiles.value
      .map((v) => v.url)
      .filter(Boolean)
      .join(","),
    thinking.value,
    knowledge.value,
    internet.value,
  );
  chatInput.value = "";
  clearQuote();
  uploadFiles.value = [];
};

const handleEnter = (e: KeyboardEvent) => {
  if (mentionOpen.value) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const direction = e.key === "ArrowDown" ? 1 : -1;
      const length = filteredAgents.value.length;
      if (length) {
        activeAgentIndex.value =
          (activeAgentIndex.value + direction + length) % length;
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      mentionOpen.value = false;
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const agent = filteredAgents.value[activeAgentIndex.value];
      if (agent) selectAgent(agent);
      return;
    }
  }
  if (e.key === "Enter") {
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    if (!getMessageContent() && !uploadFiles.value.length) return;
    emit("stopMessage");
    sendCurrentQuestion();
    (e.target as HTMLElement)?.blur();
  }
};

const sendQuestion = () => {
  sendCurrentQuestion();
};

defineExpose({ setQuote });

const clearFile = (index: number) => {
  uploadFiles.value.splice(index, 1);
};

const refreshFile = (file: File, index: number) => {
  if (isImageFile(file.name)) {
    handleImageBeforeUpload(file, [], true, index);
  } else {
    handleFileBeforeUpload(file, [], true, index);
  }
};

const handleImageBeforeUpload = async (
  file: File,
  fileList: File[],
  refresh: boolean = false,
  num?: number,
) => {
  // 大小限制：5MB
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    message.error("图片不能超过 5MB");
    return false; // 阻止自动上传
  }
  let index = num as number;
  if (!refresh) {
    uploadFiles.value.push({
      file: file,
      url: "",
      name: file.name,
      loading: true,
      image: "",
    });
    index = uploadFiles.value.length - 1;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      uploadFiles.value[index].image = base64;
      nextTick();
    };
  }

  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      uploadFiles.value[index].url = res?.data?.url;
      uploadFiles.value[index].name = res?.data?.filename;
    }
    uploadFiles.value[index].loading = false;
  } catch {
    uploadFiles.value[index].loading = false;
  }
  return false;
};

const handleFileBeforeUpload = async (
  file: File,
  fileList: File[],
  refresh: boolean = false,
  num?: number,
) => {
  // 文档限制 10MB
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error("文档不能超过 10MB");
    return false;
  }
  let index = num as number;
  if (!refresh) {
    uploadFiles.value.push({
      file: file,
      url: "",
      name: file.name,
      loading: true,
    });
    index = uploadFiles.value.length - 1;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      uploadFiles.value[index].url = res?.data?.url;
      uploadFiles.value[index].name = res?.data?.filename;
    }
    uploadFiles.value[index].loading = false;
  } catch {
    uploadFiles.value[index].loading = false;
  }
  return false;
};
</script>
<style lang="less" scoped>
.agent-slots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.agent-slot-button {
  border: 1px solid var(--app-primary);
  border-radius: 6px;
  padding: 3px 8px;
  color: var(--app-text);
  background: var(--app-primary-soft);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  text-align: left;
  &:hover {
    color: var(--app-primary);
  }
  &:focus-visible {
    outline: 2px solid var(--app-primary);
    outline-offset: 2px;
  }
}

.agent-input {
  position: relative;
  width: 100%;
  height: 100%;

  .agent-mention-menu {
    position: absolute;
    z-index: 20;
    bottom: calc(100% - 4px);
    left: 16px;
    width: min(320px, calc(100% - 32px));
    max-height: 280px;
    padding: 6px;
    overflow-y: auto;
    border: 1px solid var(--app-border-subtle);
    border-radius: 16px;
    background: var(--app-surface-solid);
    box-shadow: var(--app-shadow-float);
  }

  .agent-mention-option {
    display: flex;
    width: 100%;
    min-height: 48px;
    padding: 8px 10px;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    border: 0;
    border-radius: 10px;
    color: var(--app-text);
    text-align: left;
    background: transparent;
    cursor: pointer;

    &:hover,
    &.active {
      background: var(--app-primary-soft);
    }

    &:focus-visible {
      outline: 2px solid var(--app-primary);
      outline-offset: -2px;
    }
  }

  .agent-option-name {
    font-size: 14px;
    font-weight: 700;
  }

  .agent-option-description {
    width: 100%;
    overflow: hidden;
    color: var(--app-text-secondary);
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .agent-mention-empty {
    padding: 18px 12px;
    color: var(--app-text-tertiary);
    font-size: 13px;
    text-align: center;
  }

  .agent-input-tip {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--app-text-tertiary);
    white-space: nowrap;
  }

  :deep(.ant-sender) {
    display: flex;
    flex-direction: column;
    min-height: 140px;
    overflow: hidden;
    border: 1px solid var(--app-border-subtle);
    border-radius: 24px;
    background: var(--app-surface-solid);
    box-shadow: var(--app-shadow-soft);
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      transform 180ms ease;
  }

  :deep(.ant-sender:hover) {
    border-color: rgba(113, 103, 232, 0.36);
  }

  :deep(.ant-sender-focused) {
    border-color: var(--app-primary);
    box-shadow: var(--app-focus), var(--app-shadow-soft);
  }

  :deep(.ant-sender-content) {
    flex: 1;
    align-items: flex-start;
    padding-bottom: 0;

    .ant-input {
      border: none !important;
      border-radius: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }
  }

  :deep(.ant-sender-footer) {
    padding: 7px 10px 10px;
    border-top: 0;
    background: transparent;
  }

  :deep(.ant-sender-actions-btn) {
    border: 1px solid rgba(113, 103, 232, 0.18) !important;
    border-radius: 14px;
    color: var(--app-primary) !important;
    background: var(--app-primary-soft) !important;
    box-shadow: none !important;

    &:hover {
      border-color: rgba(113, 103, 232, 0.3) !important;
      color: var(--app-primary-hover) !important;
      background: rgba(113, 103, 232, 0.14) !important;
    }
  }
}

.input-quote {
  display: flex;
  min-width: 0;
  margin: 8px 12px 0;
  padding: 9px 8px 9px 12px;
  align-items: center;
  gap: 8px;
  border-left: 3px solid var(--app-primary);
  border-radius: 10px;
  color: var(--app-text-secondary);
  background: var(--app-primary-soft);
}

.input-quote-content {
  flex: 1;
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.input-quote-close {
  flex: 0 0 auto;
  min-width: 32px;
  min-height: 32px;
  color: var(--app-text-tertiary);

  &:hover {
    color: var(--app-text);
    background: rgba(0, 0, 0, 0.06);
  }
}

.input-tools {
  min-width: 0;

  :deep(.ant-btn) {
    min-width: 38px;
    min-height: 38px;
    border-radius: var(--app-radius-pill);
  }

  :deep(.ant-btn-link) {
    color: var(--app-primary);
    background: transparent;
  }

  :deep(.ant-divider-vertical) {
    margin-inline: 1px;
  }
}

.tool-label {
  color: var(--app-text-secondary);
  font-size: 13px;
  font-weight: 650;
}

.input-file {
  padding: 8px 8px 0;
  overflow: hidden;

  .input-file-scroll {
    overflow: auto;
  }

  .file-box-scroll {
    width: 200px;
    overflow: hidden;
    flex: 0 0 200px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .file-error {
    position: absolute;
    z-index: 9;
    width: 100%;
    height: 100%;
    background-color: var(--color-bg-elevated);
    opacity: 0.5;
    cursor: pointer;

    .ant-flex {
      height: 100%;
    }
    span {
      font-size: 24px;
    }
  }

  .file-box {
    position: relative;
    padding: 9px;
    border: 1px solid var(--app-border-subtle);
    background: var(--app-surface-soft);
    border-radius: 16px;
    max-width: 200px;
    overflow: hidden;

    .close {
      position: absolute;
      right: 4px;
      top: 4px;
      font-size: 14px;
      height: 14px;
      border-radius: var(--app-radius-pill);
      color: var(--app-danger);
      background: var(--app-surface-solid);
    }

    :deep(.ant-image) {
      flex: 0 0 50px;
      width: 50px;
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
}

@media (max-width: 768px) {
  .agent-input {
    :deep(.ant-sender) {
      min-height: 132px;
      border-radius: 20px;
    }
  }

  .tool-label,
  .input-tools :deep(.ant-divider-vertical) {
    display: none;
  }
}
</style>
