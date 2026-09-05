<template>
  <a-collapse
    v-if="active || items.length"
    v-model:active-key="chainExpandedKeys"
    class="thought-chain-shell"
    :bordered="false"
  >
    <a-collapse-panel key="chain" :show-arrow="false">
      <template #header>
        <a-flex class="thought-chain-summary" align="center" gap="8">
          <BulbOutlined v-if="chainLabel === '开始思考'" class="status-start" />
          <LoadingOutlined v-else-if="active" spin class="status-running" />
          <CloseCircleOutlined
            v-else-if="messageStatus === 'error'"
            class="status-error"
          />
          <StopOutlined
            v-else-if="messageStatus === 'cancelled'"
            class="status-muted"
          />
          <CheckCircleOutlined v-else class="status-success" />
          <span>
            {{ chainLabel }}
            <span v-if="showTimer" class="thought-chain-timer">{{
              timerText
            }}</span>
          </span>
        </a-flex>
      </template>
      <ThoughtChain
        v-if="items.length"
        class="chat-thought-chain"
        size="small"
        :items="items"
        :collapsible="{ expandedKeys, onExpand }"
      />
    </a-collapse-panel>
  </a-collapse>
</template>

<script setup lang="ts">
import { computed, h, onUnmounted, ref, watch } from "vue";
import {
  BulbOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileOutlined,
  LoadingOutlined,
  MinusCircleOutlined,
  StopOutlined,
} from "@ant-design/icons-vue";
import { Button, Flex, Tag, TypographyText, message } from "ant-design-vue";
import { ThoughtChain, type ThoughtChainItem } from "ant-design-x-vue";
import type {
  ChatNode,
  GeneratedFileDetail,
  ParsedFileDetail,
} from "@view/interfaces/agent-interface";
import { useChatStore } from "@view/stores/chat";
import { formatFileSize } from "@view/utils/file";
import { renderMarkdown } from "@view/utils/typewriter";
import {
  formatThoughtDuration,
  getNodeDisplayDetails,
  getGeneratedFiles,
  getSkillDisplayName,
  getThoughtChainLabel,
  getWorkflowNodeTitle,
  openGeneratedFilePreview,
  toThoughtChainStatus,
  type AssistantMessageStatus,
} from "@view/utils/thought-chain";

const props = withDefaults(
  defineProps<{
    nodes?: ChatNode[];
    active?: boolean;
    messageStatus?: AssistantMessageStatus;
  }>(),
  {
    nodes: () => [],
    active: false,
    messageStatus: "complete",
  },
);
const chatService = useChatStore();
const expandedKeys = ref<string[]>([]);
const chainExpandedKeys = ref<string[]>(props.active ? ["chain"] : []);
const seenNodeIds = new Set<string>();
const elapsedMilliseconds = ref(0);
const everActive = ref(false);
let timerStartedAt: number | null = null;
let timerHandle: ReturnType<typeof setInterval> | null = null;

const onExpand = (keys: string[]) => {
  expandedKeys.value = keys;
};

const stopTimer = () => {
  if (timerStartedAt !== null) {
    elapsedMilliseconds.value = Date.now() - timerStartedAt;
  }
  if (timerHandle !== null) {
    clearInterval(timerHandle);
    timerHandle = null;
  }
};

const startTimer = () => {
  if (timerHandle !== null) return;
  everActive.value = true;
  timerStartedAt = Date.now() - elapsedMilliseconds.value;
  timerHandle = setInterval(() => {
    if (timerStartedAt !== null) {
      elapsedMilliseconds.value = Date.now() - timerStartedAt;
    }
  }, 100);
};

watch(
  () => props.active,
  (active, wasActive) => {
    if (active) {
      startTimer();
      chainExpandedKeys.value = ["chain"];
      expandedKeys.value = [
        ...new Set([
          ...expandedKeys.value,
          ...(props.nodes ?? []).map((node) => node.id),
        ]),
      ];
      return;
    }
    if (wasActive && everActive.value) {
      stopTimer();
      chainExpandedKeys.value = [];
      expandedKeys.value = [];
    }
  },
  { immediate: true },
);

watch(
  () => props.nodes ?? [],
  (nodes) => {
    const additions = nodes
      .filter((node) => props.active && !seenNodeIds.has(node.id))
      .map((node) => node.id);
    nodes.forEach((node) => seenNodeIds.add(node.id));
    if (additions.length) {
      expandedKeys.value = [...new Set([...expandedKeys.value, ...additions])];
    }
  },
  { immediate: true, deep: true },
);

onUnmounted(stopTimer);

const chainLabel = computed(() =>
  getThoughtChainLabel(
    props.active,
    props.messageStatus,
    (props.nodes ?? []).length,
  ),
);
const showTimer = computed(() => everActive.value);
const timerText = computed(() =>
  formatThoughtDuration(elapsedMilliseconds.value),
);

const statusLabel = (node: ChatNode) =>
  ({
    pending: "等待执行",
    running: "执行中",
    success: "已完成",
    error: "执行失败",
    skipped: "已跳过",
  })[node.status];

const statusIcon = (node: ChatNode) => {
  if (node.status === "pending" || node.status === "running") {
    return h(LoadingOutlined, { spin: true, "aria-label": statusLabel(node) });
  }
  if (node.status === "error") {
    return h(CloseCircleOutlined, { "aria-label": statusLabel(node) });
  }
  if (node.status === "skipped") {
    return h(MinusCircleOutlined, { "aria-label": statusLabel(node) });
  }
  return h(CheckCircleOutlined, { "aria-label": statusLabel(node) });
};

const previewFile = async (file: GeneratedFileDetail) => {
  const hide = message.loading("正在获取文件资源", 0);
  try {
    await openGeneratedFilePreview(file, chatService);
  } catch (error) {
    message.error(error instanceof Error ? error.message : "文件资源获取失败");
  } finally {
    hide();
  }
};

const renderGeneratedFile = (file: GeneratedFileDetail) => {
  const format = file.format?.toUpperCase() || "FILE";
  return h(
    Flex,
    {
      class: "generated-file",
      align: "center",
      justify: "space-between",
      gap: 12,
    },
    {
      default: () => [
        h(
          Flex,
          { align: "center", gap: 8, class: "generated-file-main" },
          {
            default: () => [
              h(FileOutlined, { class: "generated-file-icon" }),
              h("div", { class: "generated-file-meta" }, [
                h("strong", { title: file.fileName }, file.fileName),
                h(
                  "span",
                  file.size
                    ? `${format} · ${formatFileSize(file.size)}`
                    : format,
                ),
              ]),
            ],
          },
        ),
        h(
          Flex,
          { gap: 8, class: "generated-file-actions" },
          {
            default: () => [
              h(
                Button,
                {
                  onClick: () => previewFile(file),
                },
                { default: () => "预览" },
              ),
              h(
                Button,
                {
                  href: file.fileUrl,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                { default: () => "下载" },
              ),
            ],
          },
        ),
      ],
    },
  );
};

const renderParsedFiles = (files: ParsedFileDetail[]) =>
  h(
    "div",
    { class: "node-detail-list" },
    files.map((file) =>
      h("section", { class: "parsed-file", key: file.url }, [
        h("strong", file.filename),
        h(
          TypographyText,
          { type: "secondary" },
          {
            default: () =>
              `${file.charCount} 字符 · ${
                file.status === "success"
                  ? "解析成功"
                  : file.status === "partial"
                    ? "部分解析成功"
                    : "解析失败"
              } · ${file.pageCount || file.sections?.length || 0} 个分段 · OCR ${file.ocrCount || 0} 张`,
          },
        ),
        file.content
          ? h("pre", { class: "node-output" }, file.content)
          : undefined,
        file.error
          ? h("p", { class: "node-error", role: "alert" }, file.error)
          : undefined,
        ...(file.warnings ?? []).map((warning) =>
          h("p", { class: "node-warning", role: "status" }, warning),
        ),
      ]),
    ),
  );

const renderNodeContent = (sourceNode: ChatNode) => {
  const node = { ...sourceNode, details: getNodeDisplayDetails(sourceNode) };
  if (node.details.status === "skipped") {
    return h("p", node.details.reason || "本轮未开启该能力，已跳过执行");
  }
  if (node.name === "skill" && node.details?.skills?.length) {
    return h(
      Flex,
      { gap: 8, wrap: "wrap", class: "skill-list" },
      {
        default: () =>
          node.details.skills?.map((skill) =>
            h(
              Tag,
              { key: skill, title: skill },
              { default: () => getSkillDisplayName(skill) },
            ),
          ),
      },
    );
  }
  if (node.kind === "file") {
    const files = getGeneratedFiles(node);
    const errors = node.details?.errors ?? [];
    return h("div", { class: "node-detail-list" }, [
      ...files.map((file) => renderGeneratedFile(file)),
      ...errors.map((error) =>
        h(
          "p",
          { class: "node-error", role: "alert" },
          `${error.format?.toUpperCase() || "文件"}：${error.error}`,
        ),
      ),
    ]);
  }
  if (node.kind === "model" && node.details?.reasoning) {
    return h("div", {
      class: "reasoning-content markdown-body",
      innerHTML: renderMarkdown(node.details.reasoning),
    });
  }
  console.log(node);
  const detailFiles = node.details?.files ?? [];
  console.log(detailFiles);
  const parsedFiles = detailFiles.filter(
    (file): file is ParsedFileDetail => "url" in file,
  );
  if (parsedFiles.length) return renderParsedFiles(parsedFiles);
  if (node.details?.items?.length) {
    return h(
      "ul",
      { class: "node-result-list" },
      node.details.items.map((item, index) =>
        h("li", { key: String(item.url || item.fileId || index) }, [
          item.url
            ? h(
                "a",
                {
                  href: String(item.url),
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                String(item.title || item.fileName || item.url),
              )
            : h("strong", String(item.title || item.fileName || "检索结果")),
          item.sourceLabel
            ? h(
                TypographyText,
                { type: "secondary" },
                { default: () => ` · ${String(item.sourceLabel)}` },
              )
            : undefined,
          item.content || item.fileContent
            ? h("p", String(item.content || item.fileContent))
            : undefined,
        ]),
      ),
    );
  }
  if (node.details?.context) {
    return h("pre", { class: "node-output" }, node.details.context);
  }
  if (node.details?.error) {
    return h("p", { class: "node-error", role: "alert" }, node.details.error);
  }
  if (node.details.output !== undefined) {
    const output = node.details.output;
    return h(
      "pre",
      { class: "node-output" },
      typeof output === "string" ? output : JSON.stringify(output, null, 2),
    );
  }
  return undefined;
};

const items = computed<ThoughtChainItem[]>(() =>
  (props.nodes ?? []).map((node) => ({
    key: node.id,
    title: getWorkflowNodeTitle(node),
    description: statusLabel(node),
    status: toThoughtChainStatus(node.status),
    icon: statusIcon(node),
    content: renderNodeContent(node),
    tooltip: true,
  })),
);
</script>

<style scoped lang="less">
.thought-chain-shell {
  width: clamp(420px, 56vw, 760px);
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: 18px;
  background: var(--app-surface-soft);
  box-shadow: 0 4px 12px rgba(74, 65, 135, 0.06);
}

.thought-chain-summary {
  font-size: 14px;
  font-weight: 500;
}

.thought-chain-timer {
  margin-left: 8px;
  color: var(--color-text-tertiary);
  font-variant-numeric: tabular-nums;
  font-weight: 400;
}

.status-start {
  color: var(--color-warning);
}

.status-running {
  color: var(--color-primary);
}

.status-success {
  color: var(--color-success);
}

.status-error {
  color: var(--color-error);
}

.status-muted {
  color: var(--color-text-tertiary);
}

:deep(.thought-chain-shell > .ant-collapse-item > .ant-collapse-header) {
  min-height: 52px;
  align-items: center;
  padding: 8px 16px;
  color: var(--app-text-secondary);
  border-radius: 18px;
}

:deep(.ant-thought-chain-item-collapse-icon) {
  display: none;
}

:deep(.ant-thought-chain-item-header) {
  pointer-events: none;
}

:deep(.ant-thought-chain-item-header-box) {
  pointer-events: auto;
}

:deep(.thought-chain-shell .ant-collapse-content-box) {
  padding: 0 16px 12px;
}

.chat-thought-chain {
  width: 100%;
}

:deep(.generated-file) {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--app-border-subtle);
  border-radius: 14px;
  background: var(--app-surface-solid);
}

:deep(.generated-file-main),
:deep(.generated-file-meta) {
  min-width: 0;
}

:deep(.generated-file-meta) {
  display: flex;
  flex-direction: column;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

:deep(.generated-file-icon) {
  flex: 0 0 auto;
  font-size: 24px;
}

:deep(.node-detail-list) {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

:deep(.parsed-file) {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

:deep(.node-output) {
  max-height: 280px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  border-radius: 14px;
  background: var(--app-surface-mint);
  font: inherit;
  line-height: 1.6;
}

:deep(.node-error) {
  margin: 0;
  color: var(--color-error);
}

:deep(.node-warning) {
  color: #d48806;
  margin: 4px 0 0;
}

:deep(.node-result-list) {
  margin: 0;
  padding-left: 20px;
}

:deep(.reasoning-content) {
  max-height: 320px;
  overflow: auto;
  line-height: 1.6;
}

@media (max-width: 768px) {
  :deep(.generated-file) {
    align-items: flex-start;
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  :deep(*) {
    animation-duration: 0.01ms !important;
  }
}
</style>
