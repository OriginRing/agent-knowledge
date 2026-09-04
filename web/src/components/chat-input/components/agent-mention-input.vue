<template>
  <div
    ref="editorRef"
    v-bind="inputAttrs"
    :class="['agent-mention-editor', attrs.class, { empty: !value }]"
    :style="attrs.style as StyleValue"
    role="textbox"
    aria-multiline="true"
    :aria-disabled="disabled"
    :contenteditable="!disabled && !readOnly"
    :data-placeholder="placeholder"
    :spellcheck="true"
    @input="handleInput"
    @keydown="handleKeydown"
    @compositionstart="onCompositionstart"
    @compositionend="onCompositionend"
    @copy="handleCopy"
    @paste="handlePaste"
    @mousedown.stop="focusEditor"
  ></div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onBeforeUnmount,
  onMounted,
  ref,
  useAttrs,
  watch,
  type StyleValue,
} from "vue";
import type { ChangeEvent } from "ant-design-vue/es/_util/EventInterface";

import type { AgentDetail } from "@view/interfaces/agent-interface";
import {
  agentMentionKey,
  type AgentMentionEditorApi,
} from "./agent-mention-context";

defineOptions({ inheritAttrs: false });

const CARET_ANCHOR = "\u2060";

const props = withDefaults(
  defineProps<{
    value?: string;
    placeholder?: string;
    disabled?: boolean;
    readOnly?: boolean;
    onChange?: (event: ChangeEvent) => void;
    onKeydown?: (event: KeyboardEvent) => void;
    onPressEnter?: (event: KeyboardEvent) => void;
    onCompositionstart?: (event: CompositionEvent) => void;
    onCompositionend?: (event: CompositionEvent) => void;
    onPaste?: (event: ClipboardEvent) => void;
  }>(),
  {
    value: "",
    placeholder: "",
    disabled: false,
    readOnly: false,
    onChange: undefined,
    onKeydown: undefined,
    onPressEnter: undefined,
    onCompositionstart: undefined,
    onCompositionend: undefined,
    onPaste: undefined,
  },
);

const attrs = useAttrs();
const inputAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) =>
        key.startsWith("aria-") ||
        key.startsWith("data-") ||
        ["id", "name", "tabindex", "title"].includes(key),
    ),
  ),
);
const context = inject(agentMentionKey);
const editorRef = ref<HTMLDivElement>();
let hasMention = false;

const getEditorText = () => {
  if (!editorRef.value) return "";
  const clone = editorRef.value.cloneNode(true) as HTMLDivElement;
  clone
    .querySelectorAll("[data-agent-mention]")
    .forEach((node) => node.remove());
  return (clone.innerText || clone.textContent || "").replaceAll(
    CARET_ANCHOR,
    "",
  );
};

const emitValue = () => {
  props.onChange?.({
    target: { value: getEditorText() },
  } as ChangeEvent);
};

const setCaretToEnd = () => {
  if (!editorRef.value) return;
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.selectNodeContents(editorRef.value);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
};

const hasAgentIdentity = (agent?: AgentDetail): agent is AgentDetail =>
  typeof agent?.agentCode === "string" &&
  Boolean(agent.agentCode.trim()) &&
  Boolean(agent.agentName.trim());

const createMentionNode = (agent: AgentDetail) => {
  const mention = document.createElement("span");
  mention.className = "selected-agent";
  mention.dataset.agentMention = agent.agentCode;
  mention.contentEditable = "false";
  mention.append(`@${agent.agentName}`);
  mention.addEventListener("mousedown", (event) => event.stopPropagation());

  const close = document.createElement("span");
  close.className = "selected-agent-close";
  close.contentEditable = "false";
  close.tabIndex = 0;
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", `清除智能体 ${agent.agentName}`);
  mention.append(close);

  const clear = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    removeMention();
    context?.clearAgent();
  };
  close.addEventListener("mousedown", clear);
  close.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") clear(event);
  });
  return mention;
};

const removeTrailingTrigger = (length: number) => {
  if (!editorRef.value || length <= 0) return;
  const walker = document.createTreeWalker(
    editorRef.value,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let remaining = length;
  for (let index = nodes.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const node = nodes[index];
    if (node.parentElement?.closest("[data-agent-mention]")) continue;
    const removeCount = Math.min(node.data.length, remaining);
    node.deleteData(node.data.length - removeCount, removeCount);
    remaining -= removeCount;
  }
};

const removeCaretAnchors = () => {
  if (!editorRef.value) return;
  const walker = document.createTreeWalker(
    editorRef.value,
    NodeFilter.SHOW_TEXT,
  );
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    node.data = node.data.replaceAll(CARET_ANCHOR, "");
    if (!node.data) node.remove();
  });
};

const removeMention = () => {
  hasMention = false;
  editorRef.value?.querySelector("[data-agent-mention]")?.remove();
  removeCaretAnchors();
  emitValue();
};

const insertMention = (agent: AgentDetail, triggerLength: number) => {
  if (!editorRef.value || !hasAgentIdentity(agent)) return;
  editorRef.value.querySelector("[data-agent-mention]")?.remove();
  removeCaretAnchors();
  removeTrailingTrigger(triggerLength);
  editorRef.value.append(
    createMentionNode(agent),
    document.createTextNode(CARET_ANCHOR),
  );
  hasMention = true;
  editorRef.value.normalize();
  editorRef.value.focus();
  setCaretToEnd();
  emitValue();
};

const focusSlot = () => {
  editorRef.value?.focus();
  const slot = editorRef.value?.querySelector(".slot-placeholder");
  const node = slot?.firstChild;
  const selection = window.getSelection();
  if (!node || !selection) {
    setCaretToEnd();
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(slot!);
  selection.removeAllRanges();
  selection.addRange(range);
};

const resetEditor = () => {
  if (!editorRef.value) return;
  const mention = editorRef.value.querySelector("[data-agent-mention]");
  editorRef.value.replaceChildren();
  if (mention)
    editorRef.value.append(mention, document.createTextNode(CARET_ANCHOR));
};

// Only explicit agent templates create highlights. Typed/pasted text stays literal.
const insertSlot = (content: string) => {
  if (!editorRef.value) return;
  resetEditor();
  const parts = content.split(/(<<[^<>\n]+>>|\{\{[^{}\n]+\}\})/g);
  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      editorRef.value?.append(document.createTextNode(part));
    } else {
      const span = document.createElement("span");
      span.className = `slot-placeholder ${part.startsWith("<<") ? "slot-angle" : "slot-brace"}`;
      span.title = "请修改这里的值";
      span.textContent = part.slice(2, -2);
      editorRef.value?.append(span);
    }
  });
  emitValue();
  focusSlot();
};

const editorApi: AgentMentionEditorApi = {
  insertMention,
  removeMention,
  insertSlot,
};

const syncValue = () => {
  if (!editorRef.value || getEditorText() === props.value) return;
  resetEditor();
  editorRef.value.append(document.createTextNode(props.value));
};

watch(
  () => props.value,
  () => syncValue(),
);
const syncMention = () => {
  const editor = editorRef.value;
  if (!editor) return;
  const agent = context?.selectedAgent.value;
  const current = editor.querySelector<HTMLElement>("[data-agent-mention]");
  if (
    !hasAgentIdentity(agent) ||
    (agent.default && current?.dataset.agentMention !== agent.agentCode)
  ) {
    hasMention = false;
    current?.remove();
    removeCaretAnchors();
    return;
  }
  if (
    current?.dataset.agentMention === agent.agentCode &&
    current.firstChild?.textContent === `@${agent.agentName}`
  )
    return;
  const mention = createMentionNode(agent);
  if (current) current.replaceWith(mention);
  else editor.prepend(mention, document.createTextNode(CARET_ANCHOR));
  hasMention = true;
};

watch(
  () => [
    context?.selectedAgent.value?.agentCode,
    context?.selectedAgent.value?.agentName,
    context?.selectedAgent.value?.default,
  ],
  syncMention,
  { flush: "post" },
);

const handleInput = (event?: Event) => {
  const editor = editorRef.value;
  const mentionRemoved =
    hasMention && !editor?.querySelector("[data-agent-mention]");
  if (mentionRemoved) {
    hasMention = false;
    removeCaretAnchors();
    context?.clearAgent();
  }
  // Browsers leave <br>, empty blocks or styled spans after deleting all content.
  // Clean only deletion results, so intentional Shift+Enter line breaks survive.
  const isDeletion = (event as InputEvent | undefined)?.inputType?.startsWith(
    "delete",
  );
  if (editor && (mentionRemoved || isDeletion) && !getEditorText().trim()) {
    resetEditor();
    setCaretToEnd();
  }
  emitValue();
};

const handleKeydown = (event: KeyboardEvent) => {
  props.onKeydown?.(event);
  if (event.key === "Enter") props.onPressEnter?.(event);
};

const handleCopy = (event: ClipboardEvent) => {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editorRef.value) return;
  const range = selection.getRangeAt(0);
  if (!editorRef.value.contains(range.commonAncestorContainer)) return;

  const container = document.createElement("div");
  container.append(range.cloneContents());
  container
    .querySelectorAll("[data-agent-mention]")
    .forEach((node) => node.remove());
  event.preventDefault();
  event.clipboardData?.setData(
    "text/plain",
    (container.textContent || "").replaceAll(CARET_ANCHOR, ""),
  );
};

const handlePaste = (event: ClipboardEvent) => {
  props.onPaste?.(event);
  if (event.defaultPrevented || !editorRef.value) return;
  const text = event.clipboardData?.getData("text/plain");
  if (text === undefined) return;

  event.preventDefault();
  const selection = window.getSelection();
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined;
  const textNode = document.createTextNode(text);
  if (range && editorRef.value.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else {
    editorRef.value.append(textNode);
    setCaretToEnd();
  }
  emitValue();
};

const focusEditor = (event?: MouseEvent) => {
  if (props.disabled || props.readOnly) return;
  if (event?.target !== editorRef.value) return;
  editorRef.value?.focus();
  setCaretToEnd();
};

onMounted(() => {
  syncValue();
  syncMention();
  if (context) context.editorApi.value = editorApi;
});

onBeforeUnmount(() => {
  if (context?.editorApi.value === editorApi)
    context.editorApi.value = undefined;
});

defineExpose({
  nativeElement: editorRef,
  focus: () => {
    editorRef.value?.focus();
    setCaretToEnd();
  },
  blur: () => editorRef.value?.blur(),
});
</script>

<style scoped lang="less">
.agent-mention-editor {
  width: 100%;
  min-width: 0;
  min-height: 26px;
  align-self: flex-start;
  max-height: 78px;
  overflow-x: hidden;
  overflow-y: auto;
  color: var(--app-text);
  font: inherit;
  line-height: 26px;
  overflow-wrap: anywhere;
  word-break: break-all;
  white-space: pre-wrap;
  cursor: text;
  outline: none;

  &.empty::after {
    color: var(--app-text-tertiary);
    content: attr(data-placeholder);
    pointer-events: none;
  }
}

:deep(.slot-placeholder) {
  border-radius: 4px;
  font-weight: 600;
}

:deep(.slot-angle) {
  background: var(--app-primary-soft);
  color: var(--app-primary);
  box-shadow: inset 0 -1px var(--app-primary);
}

:deep(.slot-brace) {
  background: var(--app-peach-soft);
  color: var(--app-text);
  outline: 1px dashed var(--app-peach);
  outline-offset: -1px;
}

:deep(.selected-agent) {
  display: inline-flex;
  margin: 0 4px;
  padding: 0 5px;
  align-items: center;
  gap: 3px;
  border-radius: 5px;
  color: var(--app-primary);
  font-size: inherit;
  font-weight: 650;
  line-height: 22px;
  vertical-align: baseline;
  background: var(--app-primary-soft);
  cursor: default;
  user-select: none;
  -webkit-user-select: none;

  &:hover {
    color: var(--app-primary-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--app-primary);
    outline-offset: 1px;
  }
}

:deep(.selected-agent-close) {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  line-height: 1;
  user-select: none;

  &::before {
    content: "×";
  }

  &:focus-visible {
    outline: 1px solid currentcolor;
    outline-offset: 1px;
  }
}
</style>
