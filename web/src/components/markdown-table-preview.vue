<template>
  <Modal
    v-model:open="open"
    width="100%"
    wrap-class-name="markdown-table-preview-modal"
    :footer="null"
    :closable="false"
    :mask-closable="false"
    :focus-trigger-after-close="false"
    :get-container="getContainer"
    :after-close="afterClose"
    destroy-on-close
  >
    <template #title>
      <div class="markdown-table-preview-header">
        <span class="markdown-table-preview-title">表格预览</span>
        <div class="markdown-table-preview-search">
          <Input
            v-model:value="searchText"
            placeholder="搜索表格全文"
            aria-label="搜索表格全文"
            allow-clear
            @keydown="handleSearchKeydown"
          >
            <template #prefix><SearchOutlined /></template>
          </Input>
          <span
            class="markdown-table-search-count"
            role="status"
            aria-live="polite"
          >
            {{
              searchText && !searchResult.count
                ? "无匹配"
                : `${searchResult.count ? activeMatch + 1 : 0} / ${searchResult.count}`
            }}
          </span>
          <Button
            type="text"
            aria-label="上一个匹配"
            title="上一个匹配（Shift+Enter）"
            :disabled="!searchResult.count"
            @click="navigateMatch(-1)"
            ><UpOutlined
          /></Button>
          <Button
            type="text"
            aria-label="下一个匹配"
            title="下一个匹配（Enter）"
            :disabled="!searchResult.count"
            @click="navigateMatch(1)"
            ><DownOutlined
          /></Button>
        </div>
        <button
          class="markdown-table-fullscreen-button"
          type="button"
          aria-label="退出全屏表格"
          aria-pressed="true"
          title="退出全屏"
          @click="open = false"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M9 3v6H3v2h8V3H9Zm6 0h-2v8h8V9h-6V3ZM3 13v2h6v6h2v-8H3Zm10 0v8h2v-6h6v-2h-8Z"
            />
          </svg>
          <span>退出全屏</span>
        </button>
      </div>
    </template>
    <div
      ref="contentRef"
      class="markdown-body markdown-table-preview-content"
      tabindex="0"
      role="region"
      aria-label="表格内容，可滚动查看"
      v-html="searchResult.html"
    ></div>
  </Modal>
</template>

<script setup lang="ts">
import { Button, Input, Modal } from "ant-design-vue";
import {
  DownOutlined,
  SearchOutlined,
  UpOutlined,
} from "@ant-design/icons-vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { searchTable } from "@view/utils/table-search";

const open = ref(false);
const tableHtml = ref("");
const contentRef = ref<HTMLDivElement | null>(null);
const searchText = ref("");
const activeMatch = ref(0);
const searchResult = computed(() =>
  searchTable(tableHtml.value, searchText.value),
);
let trigger: HTMLButtonElement | null = null;

const getContainer = () => document.body;

const afterClose = () => {
  tableHtml.value = "";
  searchText.value = "";
  activeMatch.value = 0;
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  trigger = null;
};

const handleClick = (event: MouseEvent) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>(
    "button[data-markdown-table-preview]",
  );
  if (!button || button.disabled) return;
  const table = button
    .closest(".markdown-table")
    ?.querySelector<HTMLTableElement>(":scope > table");
  if (!table) return;

  const snapshot = table.cloneNode(true) as HTMLTableElement;
  snapshot.removeAttribute("id");
  snapshot
    .querySelectorAll("[id]")
    .forEach((node) => node.removeAttribute("id"));
  trigger = button;
  searchText.value = "";
  activeMatch.value = 0;
  tableHtml.value = snapshot.outerHTML;
  open.value = true;
};

const navigateMatch = (direction: number) => {
  const count = searchResult.value.count;
  if (!count) return;
  activeMatch.value = (activeMatch.value + direction + count) % count;
  revealActiveMatch();
};

const handleSearchKeydown = (event: KeyboardEvent) => {
  if (event.isComposing || event.keyCode === 229 || !searchResult.value.count)
    return;
  if (
    event.key === "Enter" ||
    event.key === "ArrowDown" ||
    event.key === "ArrowUp"
  ) {
    event.preventDefault();
    navigateMatch(event.shiftKey || event.key === "ArrowUp" ? -1 : 1);
  }
};

watch(searchText, () => {
  activeMatch.value = 0;
});
const revealActiveMatch = () => {
  const container = contentRef.value;
  if (!container) return;
  const marks = container.querySelectorAll<HTMLElement>(
    "mark[data-table-match]",
  );
  marks.forEach((mark) => {
    mark.classList.toggle(
      "is-active",
      Number(mark.dataset.tableMatch) === activeMatch.value,
    );
  });
  const target = container.querySelector<HTMLElement>("mark.is-active");
  if (!target) return;

  const viewport = container.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  const headerHeight =
    container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
  const visibleTop =
    viewport.top +
    container.clientTop +
    (target.closest("thead") ? 0 : headerHeight) +
    8;
  const visibleBottom =
    viewport.top + container.clientTop + container.clientHeight - 8;
  const visibleLeft = viewport.left + container.clientLeft + 8;
  const visibleRight =
    viewport.left + container.clientLeft + container.clientWidth - 8;
  if (rect.top < visibleTop) container.scrollTop += rect.top - visibleTop;
  else if (rect.bottom > visibleBottom)
    container.scrollTop += rect.bottom - visibleBottom;
  if (rect.left < visibleLeft) container.scrollLeft += rect.left - visibleLeft;
  else if (rect.right > visibleRight)
    container.scrollLeft += rect.right - visibleRight;
};

watch([() => searchResult.value.html, contentRef], revealActiveMatch, {
  flush: "post",
});

onMounted(() => document.addEventListener("click", handleClick));
onBeforeUnmount(() => {
  document.removeEventListener("click", handleClick);
  if (trigger?.isConnected) trigger.focus({ preventScroll: true });
  trigger = null;
});
</script>

<style lang="less">
.markdown-table-preview-modal {
  overflow: hidden;

  .ant-modal {
    top: 0;
    max-width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;

    > div:first-child {
      height: 100%;
    }
  }

  .ant-modal-content {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: 0;
    overflow: hidden;
    border-radius: 0;
  }

  .ant-modal-header {
    flex: none;
    margin: 0;
    padding: 16px 24px;
    border-bottom: 1px solid var(--app-border);
  }

  .markdown-table-preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .markdown-table-preview-title,
  .markdown-table-preview-header > button {
    flex: none;
  }

  .ant-modal-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    padding: 16px;
  }

  .markdown-table-preview-search {
    display: flex;
    flex: 1;
    min-width: 0;
    max-width: 600px;
    align-items: center;
    gap: 8px;

    .ant-input-affix-wrapper {
      flex: 1;
      min-width: 0;
      max-width: 400px;
    }

    .ant-btn {
      flex: none;
      width: 36px;
      padding: 0;
    }
  }

  .markdown-table-search-count {
    flex: none;
    min-width: 48px;
    color: var(--app-text-secondary);
    font-size: 13px;
    font-weight: normal;
    text-align: center;
  }

  .ant-modal-body .markdown-body.markdown-table-preview-content {
    flex: 1;
    min-width: 0;
    padding: 0 8px 8px;
    overflow: auto;
    overscroll-behavior: contain;
    color: var(--app-text);
    background: transparent;

    mark[data-table-match] {
      padding: 0;
      color: var(--app-text);
      background: var(--app-peach-soft);

      &.is-active {
        color: #fff;
        background: var(--app-primary);
        outline: 1px solid var(--app-primary);
      }
    }

    &:focus-visible {
      outline: 2px solid var(--app-primary);
      outline-offset: -2px;
    }

    table {
      display: table;
      width: 100%;
      max-width: none;
      margin: 0;
      overflow: visible;
      border-collapse: separate;
      border-spacing: 0;
    }

    th,
    td {
      min-width: 120px;
    }

    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      white-space: nowrap;
      color: var(--app-text);
      background: var(--app-bg);
    }
  }
}
@media (max-width: 640px) {
  .markdown-table-preview-modal {
    .ant-modal-header {
      padding: 12px;
    }
    .markdown-table-preview-header {
      gap: 8px;
    }
    .markdown-table-preview-title {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .markdown-table-preview-search {
      gap: 4px;
      .ant-btn {
        width: 28px;
      }
    }
    .markdown-table-search-count {
      min-width: 40px;
      font-size: 12px;
    }
  }
}
</style>
