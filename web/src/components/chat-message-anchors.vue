<template>
  <nav
    v-if="anchors.length > 1"
    class="message-anchors"
    aria-label="对话位置导航"
  >
    <ol class="message-anchor-list" @mouseleave="hoveredKey = undefined">
      <li v-for="anchor in anchors" :key="anchor.key">
        <button
          class="message-anchor"
          type="button"
          :class="{ 'is-active': anchor.key === activeKey }"
          :style="{ '--anchor-scale': getAnchorScale(anchor.index) }"
          :aria-label="`定位到第 ${anchor.index} 个问题：${anchor.title}`"
          :aria-current="anchor.key === activeKey ? 'location' : undefined"
          @click="$emit('select', anchor.key)"
          @mouseenter="hoveredKey = anchor.key"
          @focus="focusedKey = anchor.key"
          @blur="focusedKey = undefined"
        >
          <span class="message-anchor-line" aria-hidden="true"></span>
          <span class="message-anchor-preview" role="tooltip">
            <strong>{{ anchor.title }}</strong>
          </span>
        </button>
      </li>
    </ol>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import type { AgentChat } from "@view/interfaces/agent-interface";

const props = defineProps<{
  items: AgentChat[];
  activeKey?: string;
}>();

defineEmits<{
  select: [key: string];
}>();

const hoveredKey = ref<string>();
const focusedKey = ref<string>();
const waveIndex = computed(
  () =>
    anchors.value.find(
      (anchor) => anchor.key === (hoveredKey.value ?? focusedKey.value),
    )?.index,
);
const getAnchorScale = (index: number) => {
  if (waveIndex.value === undefined) return 1;

  const distance = Math.abs(index - waveIndex.value);
  return [3, 2.375, 1.75, 1.25][distance] ?? 1;
};

const cleanPreviewText = (content: string) =>
  content
    .replace(/```[\s\S]*?```/g, " 代码片段 ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " 图片 ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~`>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const anchors = computed(() =>
  props.items
    .filter((item) => item.role === "user")
    .map((item, index) => {
      const preview = cleanPreviewText(item.content);
      const title = preview || "文件问题";

      return {
        key: item.key,
        index: index + 1,
        title: title,
      };
    }),
);
</script>

<style scoped lang="less">
.message-anchors {
  position: absolute;
  z-index: 12;
  top: 50%;
  left: 2px;
  transform: translateY(-50%);
}

.message-anchor-list {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 0;
  padding: 0;
  list-style: none;
}

.message-anchor {
  position: relative;
  display: flex;
  width: 28px;
  height: 12px;
  padding: 0;
  align-items: center;
  border: 0;
  color: var(--app-text-tertiary);
  background: transparent;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--app-primary);
    outline-offset: -4px;
    border-radius: 8px;
  }

  &:focus-visible,
  &.is-active {
    color: var(--app-text);

    .message-anchor-line {
      background: currentcolor;
    }
  }

  &:hover {
    color: var(--app-text);

    .message-anchor-line {
      background: currentcolor;
    }
  }

  &:hover,
  &:focus-visible {
    .message-anchor-preview {
      visibility: visible;
      opacity: 1;
      transform: translate(0, -50%);
    }
  }
}

.message-anchor-line {
  display: block;
  width: 8px;
  height: 2px;
  border-radius: 999px;
  background: currentcolor;
  transform: scaleX(var(--anchor-scale, 1));
  transform-origin: left center;
  transition:
    transform 220ms cubic-bezier(0.22, 1, 0.36, 1),
    background-color 180ms ease;
}

.message-anchor-preview {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: 38px;
  display: flex;
  visibility: hidden;
  width: min(380px, calc(100vw - 96px));
  max-height: 132px;
  padding: 12px 14px;
  flex-direction: column;
  gap: 6px;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: 12px;
  color: var(--app-text);
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-soft);
  opacity: 0;
  pointer-events: none;
  transform: translate(-8px, -50%);
  transition:
    opacity 160ms ease,
    transform 160ms ease,
    visibility 160ms;
  text-align: left;

  strong {
    overflow: hidden;
    font-size: 14px;
    line-height: 1.45;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    display: -webkit-box;
    overflow: hidden;
    color: var(--app-text-secondary);
    font-size: 13px;
    line-height: 1.5;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
  }
}

@media (max-width: 768px) {
  .message-anchors {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .message-anchor-line,
  .message-anchor-preview {
    transition: none;
  }
}
</style>
