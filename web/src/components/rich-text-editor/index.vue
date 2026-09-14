<template>
  <div
    class="rich-text-editor"
    :class="{ 'is-disabled': disabled, 'is-fullscreen': isFullscreen }"
  >
    <div class="editor-toolbar" role="toolbar" aria-label="富文本编辑工具栏">
      <div class="toolbar-group" role="group" aria-label="文本结构">
        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-button
            type="text"
            class="toolbar-heading-button"
            :disabled="disabled || !editor"
            aria-label="选择标题级别"
          >
            {{ currentHeadingLabel() }}
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu class="rich-text-format-menu">
              <a-menu-item @click="setHeadingLevel(0)">正文</a-menu-item>
              <a-menu-item
                v-for="level in headingLevels"
                :key="level"
                @click="setHeadingLevel(level)"
              >
                H{{ level }} 标题
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="toolbar-group" role="group" aria-label="文字格式">
        <a-tooltip title="粗体">
          <a-button
            type="text"
            class="toolbar-group-first"
            :disabled="disabled || !editor?.can().toggleBold()"
            :aria-pressed="editor?.isActive('bold') ?? false"
            aria-label="切换粗体"
            :class="{ active: editor?.isActive('bold') }"
            @click="editor?.chain().focus().toggleBold().run()"
          >
            <template #icon><BoldOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="下划线">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().toggleUnderline()"
            :aria-pressed="editor?.isActive('underline') ?? false"
            aria-label="切换下划线"
            :class="{ active: editor?.isActive('underline') }"
            @click="editor?.chain().focus().toggleUnderline().run()"
          >
            <template #icon><UnderlineOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="斜体">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().toggleItalic()"
            :aria-pressed="editor?.isActive('italic') ?? false"
            aria-label="切换斜体"
            :class="{ active: editor?.isActive('italic') }"
            @click="editor?.chain().focus().toggleItalic().run()"
          >
            <template #icon><ItalicOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="删除线">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().toggleStrike()"
            :aria-pressed="editor?.isActive('strike') ?? false"
            aria-label="切换删除线"
            :class="{ active: editor?.isActive('strike') }"
            @click="editor?.chain().focus().toggleStrike().run()"
          >
            <template #icon><StrikethroughOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="行内代码">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().toggleCode()"
            :aria-pressed="editor?.isActive('code') ?? false"
            aria-label="切换行内代码"
            :class="{ active: editor?.isActive('code') }"
            @click="editor?.chain().focus().toggleCode().run()"
          >
            <template #icon><CodeOutlined /></template>
          </a-button>
        </a-tooltip>
      </div>

      <div class="toolbar-group" role="group" aria-label="文字样式">
        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-tooltip title="文字颜色">
            <a-button
              type="text"
              class="toolbar-group-first"
              :disabled="disabled || !editor"
              aria-label="文字颜色"
              :class="{ active: editor?.getAttributes('textStyle').color }"
            >
              <template #icon><FontColorsOutlined /></template>
            </a-button>
          </a-tooltip>
          <template #overlay>
            <a-menu class="rich-text-color-menu">
              <a-menu-item
                key="default-color"
                class="color-reset-item"
                aria-label="恢复默认文字颜色"
                @click="setTextColor('')"
              >
                <span class="color-swatch is-default" />
                默认颜色
              </a-menu-item>
              <a-menu-item
                v-for="color in colorPalette"
                :key="`text-${color.value}`"
                class="color-palette-item"
                :aria-label="`文字颜色：${color.label}`"
                :title="color.label"
                @click="setTextColor(color.value)"
              >
                <span
                  class="color-swatch"
                  :style="{ backgroundColor: color.value }"
                />
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-tooltip title="文字高亮">
            <a-button
              type="text"
              :disabled="disabled || !editor"
              aria-label="文字高亮"
              :class="{
                active: editor?.getAttributes('textStyle').backgroundColor,
              }"
            >
              <template #icon><HighlightOutlined /></template>
            </a-button>
          </a-tooltip>
          <template #overlay>
            <a-menu class="rich-text-color-menu">
              <a-menu-item
                key="default-highlight"
                class="color-reset-item"
                aria-label="取消文字高亮"
                @click="setHighlightColor('')"
              >
                <span class="color-swatch is-default" />
                取消高亮
              </a-menu-item>
              <a-menu-item
                v-for="color in colorPalette"
                :key="`highlight-${color.value}`"
                class="color-palette-item"
                :aria-label="`高亮颜色：${color.label}`"
                :title="color.label"
                @click="setHighlightColor(color.value)"
              >
                <span
                  class="color-swatch"
                  :style="{ backgroundColor: color.value }"
                />
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-button
            type="text"
            class="toolbar-menu-button"
            :disabled="disabled || !editor"
            aria-label="设置字号"
          >
            字号
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu class="rich-text-format-menu">
              <a-menu-item
                v-for="size in fontSizes"
                :key="size.value || 'default-size'"
                @click="setFontSize(size.value)"
              >
                {{ size.label }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-button
            type="text"
            class="toolbar-menu-button toolbar-font-button"
            :disabled="disabled || !editor"
            aria-label="设置字体"
          >
            字体
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu class="rich-text-format-menu">
              <a-menu-item
                v-for="family in fontFamilies"
                :key="family.value || 'default-font'"
                :style="family.value ? { fontFamily: family.value } : {}"
                @click="setFontFamily(family.value)"
              >
                {{ family.label }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>

        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-button
            type="text"
            class="toolbar-menu-button"
            :disabled="disabled || !editor"
            aria-label="设置行高"
          >
            行高
            <DownOutlined />
          </a-button>
          <template #overlay>
            <a-menu class="rich-text-format-menu">
              <a-menu-item
                v-for="height in lineHeights"
                :key="height.value || 'default-line-height'"
                @click="setLineHeight(height.value)"
              >
                {{ height.label }}
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div class="toolbar-group" role="group" aria-label="段落格式">
        <a-tooltip title="项目列表">
          <a-button
            type="text"
            class="toolbar-group-first"
            :disabled="disabled"
            :aria-pressed="editor?.isActive('bulletList') ?? false"
            aria-label="切换项目列表"
            :class="{ active: editor?.isActive('bulletList') }"
            @click="editor?.chain().focus().toggleBulletList().run()"
          >
            <template #icon><UnorderedListOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="编号列表">
          <a-button
            type="text"
            :disabled="disabled"
            :aria-pressed="editor?.isActive('orderedList') ?? false"
            aria-label="切换编号列表"
            :class="{ active: editor?.isActive('orderedList') }"
            @click="editor?.chain().focus().toggleOrderedList().run()"
          >
            <template #icon><OrderedListOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="任务清单">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().toggleTaskList()"
            :aria-pressed="editor?.isActive('taskList') ?? false"
            aria-label="切换任务清单"
            :class="{ active: editor?.isActive('taskList') }"
            @click="editor?.chain().focus().toggleTaskList().run()"
          >
            <template #icon><CheckSquareOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="引用">
          <a-button
            type="text"
            :disabled="disabled"
            :aria-pressed="editor?.isActive('blockquote') ?? false"
            aria-label="切换引用"
            :class="{ active: editor?.isActive('blockquote') }"
            @click="editor?.chain().focus().toggleBlockquote().run()"
          >
            <span class="toolbar-label toolbar-quote">“</span>
          </a-button>
        </a-tooltip>
        <a-tooltip title="降低列表层级">
          <a-button
            type="text"
            :disabled="disabled || !canLiftListItem()"
            aria-label="降低列表层级"
            @click="liftCurrentListItem"
          >
            <template #icon><MenuFoldOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="增加列表层级">
          <a-button
            type="text"
            :disabled="disabled || !canSinkListItem()"
            aria-label="增加列表层级"
            @click="sinkCurrentListItem"
          >
            <template #icon><MenuUnfoldOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-popover
          v-model:open="linkPopoverOpen"
          trigger="click"
          placement="bottomLeft"
        >
          <a-tooltip title="链接">
            <a-button
              type="text"
              :disabled="disabled || !editor"
              :aria-pressed="editor?.isActive('link') ?? false"
              aria-label="设置链接"
              :class="{ active: editor?.isActive('link') }"
              @click="prepareLinkEditor"
            >
              <template #icon><LinkOutlined /></template>
            </a-button>
          </a-tooltip>
          <template #content>
            <div class="link-editor" @keydown.esc="linkPopoverOpen = false">
              <label for="rich-text-editor-link">链接地址</label>
              <a-input
                id="rich-text-editor-link"
                v-model:value="linkUrl"
                placeholder="https://example.com"
                @press-enter="applyLink"
              />
              <span v-if="linkError" class="link-error" role="alert">
                {{ linkError }}
              </span>
              <div class="link-actions">
                <a-button
                  v-if="editor?.isActive('link')"
                  size="small"
                  @click="removeLink"
                >
                  移除链接
                </a-button>
                <a-button type="primary" size="small" @click="applyLink">
                  应用
                </a-button>
              </div>
            </div>
          </template>
        </a-popover>
        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-tooltip title="文字对齐">
            <a-button
              type="text"
              :disabled="disabled || !editor"
              aria-label="文字对齐"
            >
              <template #icon><AlignCenterOutlined /></template>
            </a-button>
          </a-tooltip>
          <template #overlay>
            <a-menu class="rich-text-format-menu">
              <a-menu-item @click="setTextAlign('left')">左对齐</a-menu-item>
              <a-menu-item @click="setTextAlign('center')">居中</a-menu-item>
              <a-menu-item @click="setTextAlign('right')">右对齐</a-menu-item>
              <a-menu-item @click="setTextAlign('justify')">
                两端对齐
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
        <a-tooltip title="清除格式">
          <a-button
            type="text"
            :disabled="disabled || !editor"
            aria-label="清除格式"
            @click="clearFormatting"
          >
            <template #icon><ClearOutlined /></template>
          </a-button>
        </a-tooltip>
      </div>

      <div class="toolbar-group" role="group" aria-label="表格工具">
        <a-dropdown :trigger="['click']" placement="bottomLeft">
          <a-tooltip title="表格操作">
            <a-button
              type="text"
              class="toolbar-table-button toolbar-group-first"
              :class="{ active: editor?.isActive('table') }"
              :disabled="disabled || !editor"
              :aria-pressed="editor?.isActive('table') ?? false"
              aria-label="表格操作"
            >
              <template #icon><TableOutlined /></template>
              <span>表格</span>
            </a-button>
          </a-tooltip>
          <template #overlay>
            <a-menu class="memory-table-menu">
              <a-menu-item
                key="insert-table"
                :disabled="!canRunTableAction('insertTable')"
                @click="runTableAction('insertTable')"
              >
                插入 3 × 3 表格
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item
                key="add-row-before"
                :disabled="!canRunTableAction('addRowBefore')"
                @click="runTableAction('addRowBefore')"
              >
                在上方插入行
              </a-menu-item>
              <a-menu-item
                key="add-row-after"
                :disabled="!canRunTableAction('addRowAfter')"
                @click="runTableAction('addRowAfter')"
              >
                在下方插入行
              </a-menu-item>
              <a-menu-item
                key="delete-row"
                :disabled="!canRunTableAction('deleteRow')"
                @click="runTableAction('deleteRow')"
              >
                删除当前行
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item
                key="add-column-before"
                :disabled="!canRunTableAction('addColumnBefore')"
                @click="runTableAction('addColumnBefore')"
              >
                在左侧插入列
              </a-menu-item>
              <a-menu-item
                key="add-column-after"
                :disabled="!canRunTableAction('addColumnAfter')"
                @click="runTableAction('addColumnAfter')"
              >
                在右侧插入列
              </a-menu-item>
              <a-menu-item
                key="delete-column"
                :disabled="!canRunTableAction('deleteColumn')"
                @click="runTableAction('deleteColumn')"
              >
                删除当前列
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item
                key="merge-cells"
                :disabled="!canRunTableAction('mergeCells')"
                @click="runTableAction('mergeCells')"
              >
                合并所选单元格
              </a-menu-item>
              <a-menu-item
                key="split-cell"
                :disabled="!canRunTableAction('splitCell')"
                @click="runTableAction('splitCell')"
              >
                拆分当前单元格
              </a-menu-item>
              <a-menu-item
                key="toggle-header-row"
                :disabled="!canRunTableAction('toggleHeaderRow')"
                @click="runTableAction('toggleHeaderRow')"
              >
                切换当前表头行
              </a-menu-item>
              <a-menu-divider />
              <a-menu-item
                key="delete-table"
                danger
                :disabled="!canRunTableAction('deleteTable')"
                @click="runTableAction('deleteTable')"
              >
                删除整个表格
              </a-menu-item>
            </a-menu>
          </template>
        </a-dropdown>
      </div>

      <div
        class="toolbar-group toolbar-history"
        role="group"
        aria-label="编辑历史"
      >
        <a-tooltip title="撤销">
          <a-button
            type="text"
            class="toolbar-group-first"
            :disabled="disabled || !editor?.can().undo()"
            aria-label="撤销"
            @click="editor?.chain().focus().undo().run()"
          >
            <template #icon><UndoOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip title="重做">
          <a-button
            type="text"
            :disabled="disabled || !editor?.can().redo()"
            aria-label="重做"
            @click="editor?.chain().focus().redo().run()"
          >
            <template #icon><RedoOutlined /></template>
          </a-button>
        </a-tooltip>
        <a-tooltip :title="isFullscreen ? '退出全屏' : '全屏编辑'">
          <a-button
            type="text"
            :disabled="disabled"
            :aria-pressed="isFullscreen"
            :aria-label="isFullscreen ? '退出全屏编辑' : '全屏编辑'"
            @click="toggleFullscreen"
          >
            <template #icon>
              <FullscreenExitOutlined v-if="isFullscreen" />
              <FullscreenOutlined v-else />
            </template>
          </a-button>
        </a-tooltip>
      </div>
    </div>

    <EditorContent :editor="editor" class="editor-content" />
    <div class="editor-meta" aria-live="polite">{{ characterCount }} 字</div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/vue-3";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { TextStyleKit } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import MarkdownIt from "markdown-it";
import {
  AlignCenterOutlined,
  BoldOutlined,
  CheckSquareOutlined,
  ClearOutlined,
  CodeOutlined,
  DownOutlined,
  FontColorsOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  HighlightOutlined,
  ItalicOutlined,
  LinkOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  OrderedListOutlined,
  RedoOutlined,
  StrikethroughOutlined,
  TableOutlined,
  UndoOutlined,
  UnderlineOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons-vue";
import { serializeRichTextDocument } from "./serializer";
import {
  createTextDocument,
  type RichTextEditorContent,
  type RichTextEditorInputFormat,
} from "./content";
import { RichTextImage } from "./image-extension";

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    initialContent?: string;
    initialFormat?: RichTextEditorInputFormat;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    initialContent: "",
    initialFormat: "html",
    placeholder: "请输入内容",
  },
);

const emit = defineEmits<{
  "update:html": [value: string];
  "update:text": [value: string];
}>();
const characterCount = ref(0);
const isFullscreen = ref(false);
const linkError = ref("");
const linkPopoverOpen = ref(false);
const linkUrl = ref("");
const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
});

const colorPalette = [
  { label: "黑色", value: "#000000" },
  { label: "灰色", value: "#595959" },
  { label: "中灰色", value: "#8c8c8c" },
  { label: "浅灰色", value: "#bfbfbf" },
  { label: "雾灰色", value: "#e8e8e8" },
  { label: "白色", value: "#ffffff" },
  { label: "红色", value: "#f5222d" },
  { label: "橙色", value: "#fa8c16" },
  { label: "黄色", value: "#fadb14" },
  { label: "绿色", value: "#52c41a" },
  { label: "蓝色", value: "#1677ff" },
  { label: "紫色", value: "#722ed1" },
  { label: "柔红色", value: "#ff7875" },
  { label: "柔橙色", value: "#ffc069" },
  { label: "柔黄色", value: "#ffe58f" },
  { label: "柔绿色", value: "#95de64" },
  { label: "柔蓝色", value: "#69b1ff" },
  { label: "柔紫色", value: "#b37feb" },
  { label: "浅红色", value: "#fff1f0" },
  { label: "浅橙色", value: "#fff7e6" },
  { label: "浅黄色", value: "#feffe6" },
  { label: "浅绿色", value: "#f6ffed" },
  { label: "浅蓝色", value: "#e6f4ff" },
  { label: "浅紫色", value: "#f9f0ff" },
];
const fontSizes = [
  { label: "默认字号", value: "" },
  { label: "14 px", value: "14px" },
  { label: "16 px", value: "16px" },
  { label: "18 px", value: "18px" },
  { label: "20 px", value: "20px" },
  { label: "24 px", value: "24px" },
  { label: "28 px", value: "28px" },
];
const fontFamilies = [
  { label: "默认字体", value: "" },
  { label: "黑体", value: '"Microsoft YaHei", "PingFang SC", sans-serif' },
  { label: "宋体", value: 'SimSun, "Songti SC", serif' },
  { label: "楷体", value: 'KaiTi, "Kaiti SC", serif' },
  { label: "等宽", value: 'Consolas, Monaco, "Courier New", monospace' },
];
const lineHeights = [
  { label: "默认行高", value: "" },
  { label: "单倍", value: "1" },
  { label: "1.5 倍", value: "1.5" },
  { label: "1.75 倍", value: "1.75" },
  { label: "2 倍", value: "2" },
  { label: "2.5 倍", value: "2.5" },
];

type ContentReader = {
  getHTML: () => string;
  getJSON: () => JSONContent;
};

type TableAction =
  | "addColumnAfter"
  | "addColumnBefore"
  | "addRowAfter"
  | "addRowBefore"
  | "deleteColumn"
  | "deleteRow"
  | "deleteTable"
  | "insertTable"
  | "mergeCells"
  | "splitCell"
  | "toggleHeaderRow";
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const headingLevels: HeadingLevel[] = [1, 2, 3, 4, 5, 6];

const readContent = (
  currentEditor: ContentReader | null | undefined,
): RichTextEditorContent => {
  if (!currentEditor) return { html: "", text: "" };
  return {
    html: currentEditor.getHTML(),
    text: serializeRichTextDocument(currentEditor.getJSON()),
  };
};

const emitContent = (currentEditor: ContentReader) => {
  const { html, text } = readContent(currentEditor);
  characterCount.value = text.length;
  emit("update:html", html);
  emit("update:text", text);
};

const normalizeContent = (
  content: string,
  format: RichTextEditorInputFormat,
): string | JSONContent => {
  if (format === "text") return createTextDocument(content);
  if (format === "markdown") return markdown.render(content);
  return content;
};

const editor = useEditor({
  content: normalizeContent(props.initialContent, props.initialFormat),
  extensions: [
    StarterKit.configure({
      codeBlock: false,
      heading: { levels: headingLevels },
      horizontalRule: false,
      link: {
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
      },
    }),
    TextStyleKit,
    TextAlign.configure({
      types: ["heading", "paragraph"],
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
    }),
    TableKit.configure({
      table: {
        resizable: true,
      },
    }),
    RichTextImage,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
  ],
  editorProps: {
    attributes: {
      "aria-label": "富文本内容",
      class: "rich-text-editor-surface",
    },
  },
  onCreate: ({ editor: currentEditor }) => {
    currentEditor.setEditable(!props.disabled);
    emitContent(currentEditor);
  },
  onUpdate: ({ editor: currentEditor }) => {
    emitContent(currentEditor);
  },
});

const setContent = (
  content: string,
  format: RichTextEditorInputFormat = "html",
): boolean => {
  if (!editor.value) return false;
  editor.value.commands.setContent(normalizeContent(content, format));
  return true;
};

const getContent = (): RichTextEditorContent => readContent(editor.value);
const getHTML = (): string => getContent().html;
const getText = (): string => getContent().text;

const clearContent = () => editor.value?.commands.clearContent();

const clearFormatting = () => {
  editor.value?.chain().focus().clearNodes().unsetAllMarks().run();
};

const currentHeadingLabel = (): string => {
  const level = headingLevels.find((candidate) =>
    editor.value?.isActive("heading", { level: candidate }),
  );
  return level ? `H${level}` : "正文";
};

const setHeadingLevel = (level: 0 | HeadingLevel) => {
  if (!editor.value || props.disabled) return;
  if (level === 0) editor.value.chain().focus().setParagraph().run();
  else editor.value.chain().focus().setHeading({ level }).run();
};

const setTextColor = (color: string) => {
  if (!editor.value || props.disabled) return;
  const chain = editor.value.chain().focus();
  if (color) chain.setColor(color).run();
  else chain.unsetColor().run();
};

const setHighlightColor = (color: string) => {
  if (!editor.value || props.disabled) return;
  const chain = editor.value.chain().focus();
  if (color) chain.setBackgroundColor(color).run();
  else chain.unsetBackgroundColor().run();
};

const setFontSize = (size: string) => {
  if (!editor.value || props.disabled) return;
  const chain = editor.value.chain().focus();
  if (size) chain.setFontSize(size).run();
  else chain.unsetFontSize().run();
};

const setFontFamily = (family: string) => {
  if (!editor.value || props.disabled) return;
  const chain = editor.value.chain().focus();
  if (family) chain.setFontFamily(family).run();
  else chain.unsetFontFamily().run();
};

const setLineHeight = (height: string) => {
  if (!editor.value || props.disabled) return;
  const chain = editor.value.chain().focus();
  if (height) chain.setLineHeight(height).run();
  else chain.unsetLineHeight().run();
};

const setTextAlign = (alignment: "center" | "justify" | "left" | "right") =>
  editor.value?.chain().focus().setTextAlign(alignment).run();

const currentListItemType = (): "listItem" | "taskItem" =>
  editor.value?.isActive("taskList") ? "taskItem" : "listItem";
const canSinkListItem = (): boolean =>
  editor.value?.can().sinkListItem(currentListItemType()) ?? false;
const canLiftListItem = (): boolean =>
  editor.value?.can().liftListItem(currentListItemType()) ?? false;
const sinkCurrentListItem = () =>
  editor.value?.chain().focus().sinkListItem(currentListItemType()).run();
const liftCurrentListItem = () =>
  editor.value?.chain().focus().liftListItem(currentListItemType()).run();

const prepareLinkEditor = () => {
  linkError.value = "";
  linkUrl.value = String(editor.value?.getAttributes("link").href ?? "");
};

const normalizeLink = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
};

const applyLink = () => {
  const href = normalizeLink(linkUrl.value);
  if (href === null) {
    linkError.value = "仅支持 http、https、mailto 和 tel 链接";
    return;
  }
  if (!editor.value || props.disabled) return;
  if (!href) editor.value.chain().focus().unsetLink().run();
  else
    editor.value
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href })
      .run();
  linkPopoverOpen.value = false;
};

const removeLink = () => {
  editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
  linkPopoverOpen.value = false;
};

const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value;
};

const handleEscape = (event: KeyboardEvent) => {
  if (event.key !== "Escape" || !isFullscreen.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  isFullscreen.value = false;
};

const canRunTableAction = (action: TableAction): boolean => {
  const currentEditor = editor.value;
  if (!currentEditor || props.disabled) return false;

  if (action === "insertTable") {
    return currentEditor.can().insertTable({
      rows: 3,
      cols: 3,
      withHeaderRow: true,
    });
  }
  return currentEditor.can()[action]();
};

const runTableAction = (action: TableAction) => {
  const currentEditor = editor.value;
  if (!currentEditor || !canRunTableAction(action)) return;

  if (action === "insertTable") {
    currentEditor
      .chain()
      .focus()
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run();
    return;
  }
  currentEditor.chain().focus()[action]().run();
};

defineExpose({
  clearContent,
  editor,
  getContent,
  getHTML,
  getText,
  setContent,
});

watch(
  () => props.disabled,
  (disabled) => editor.value?.setEditable(!disabled),
);

onMounted(() => window.addEventListener("keydown", handleEscape, true));
onBeforeUnmount(() =>
  window.removeEventListener("keydown", handleEscape, true),
);
</script>

<style scoped lang="less">
.rich-text-editor {
  display: flex;
  width: 100%;
  min-width: 0;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: 16px;
  background: var(--app-surface-solid);
  transition: border-color 0.2s ease;

  &:focus-within {
    border-color: var(--app-primary);
    box-shadow: var(--app-focus);
  }

  &.is-disabled {
    opacity: 0.72;
  }

  &.is-fullscreen {
    position: fixed;
    z-index: 1200;
    inset: 16px;
    width: auto;
    max-height: none;
    border-radius: 12px;
    box-shadow: 0 18px 60px rgb(0 0 0 / 24%);
  }
}

.editor-toolbar {
  display: flex;
  min-width: 0;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--app-border-subtle);
  background: var(--app-surface);

  :deep(.ant-btn) {
    width: 44px;
    height: 44px;
    color: var(--app-text-secondary);

    &.active {
      color: var(--app-primary);
      background: var(--app-primary-soft);
    }
  }

  :deep(.toolbar-table-button) {
    width: auto;
    padding-inline: 12px;
  }

  :deep(.toolbar-menu-button) {
    width: auto;
    min-width: 72px;
    padding-inline: 10px;
  }

  :deep(.toolbar-font-button) {
    min-width: 68px;
  }

  :deep(.toolbar-heading-button) {
    width: auto;
    min-width: 84px;
    justify-content: space-between;
    padding-inline: 12px;
  }
}

.toolbar-group {
  display: contents;
}

.editor-toolbar :deep(.toolbar-group-first) {
  position: relative;
  margin-left: 5px;

  &::before {
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: -5px;
    width: 1px;
    background: var(--app-border-subtle);
    content: "";
    pointer-events: none;
  }
}

.toolbar-label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.toolbar-quote {
  font-family: Georgia, serif;
  font-size: 24px;
  line-height: 1;
}

.rich-text-color-menu {
  display: grid;
  grid-template-columns: repeat(6, 28px);
  gap: 8px;
  width: max-content;
  max-width: calc(100vw - 24px);
  padding: 10px 12px 12px;

  :deep(.color-reset-item) {
    grid-column: 1 / -1;
    width: 100%;
    height: 34px;
    margin: 0 !important;
    padding: 0 2px !important;
    line-height: 34px !important;
  }

  :deep(.color-palette-item) {
    display: grid !important;
    width: 28px;
    height: 28px;
    margin: 0 !important;
    padding: 0 !important;
    place-items: center;
    line-height: 1 !important;
  }
}

.color-swatch {
  display: inline-block;
  width: 24px;
  height: 24px;
  border: 1px solid rgb(0 0 0 / 12%);
  border-radius: 3px;
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 36%);
  vertical-align: -7px;

  .color-reset-item & {
    margin-right: 8px;
  }

  &.is-default {
    position: relative;
    background: linear-gradient(
      135deg,
      transparent 45%,
      #ff4d4f 46%,
      #ff4d4f 54%,
      transparent 55%
    );
  }
}

.link-editor {
  display: grid;
  width: min(320px, calc(100vw - 40px));
  gap: 8px;

  label {
    color: var(--app-text-secondary);
    font-size: 13px;
    font-weight: 600;
  }
}

.link-error {
  color: var(--app-danger, #cf1322);
  font-size: 12px;
}

.link-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.editor-content {
  min-height: 0;
  flex: 1;
  overflow: auto;

  :deep(.rich-text-editor-surface) {
    min-height: 320px;
    padding: 20px 22px 64px;
    color: var(--app-text);
    font-size: 16px;
    font-synthesis: initial;
    line-height: 1.75;
    outline: none;

    p {
      margin: 0 0 12px;
    }

    em,
    i {
      font-style: italic;
    }

    ul,
    ol {
      margin: 0 0 12px;
      padding-left: 26px;
    }

    li p {
      margin-bottom: 4px;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 4px 0 12px;
      color: var(--app-text);
      line-height: 1.4;
    }

    h1 {
      font-size: 26px;
    }

    h2 {
      font-size: 22px;
    }

    h3 {
      font-size: 18px;
    }

    h4 {
      font-size: 16px;
    }

    h5 {
      font-size: 15px;
    }

    h6 {
      font-size: 14px;
    }

    blockquote {
      margin: 0 0 12px;
      padding: 4px 0 4px 14px;
      border-left: 3px solid var(--app-primary);
      color: var(--app-text-secondary);
    }

    code {
      padding: 2px 5px;
      border-radius: 5px;
      background: var(--app-surface-soft);
      font-family: var(--mono);
      font-size: 0.9em;
    }

    a {
      color: var(--app-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    ul[data-type="taskList"] {
      padding-left: 0;
      list-style: none;

      li {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        > label {
          display: inline-flex;
          min-width: 24px;
          min-height: 28px;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        > div {
          min-width: 0;
          flex: 1;
        }
      }

      input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--app-primary);
      }
    }

    .tableWrapper {
      margin: 4px 0 16px;
      overflow-x: auto;
      overscroll-behavior-inline: contain;
    }

    table {
      width: 100%;
      min-width: 420px !important;
      border-collapse: collapse;
      table-layout: fixed;

      th,
      td {
        position: relative;
        min-width: 110px;
        padding: 9px 11px;
        border: 1px solid var(--app-border-subtle);
        vertical-align: top;

        > *:last-child {
          margin-bottom: 0;
        }
      }

      th {
        background: var(--app-surface-soft);
        font-weight: 600;
        text-align: left;
      }

      .selectedCell::after {
        position: absolute;
        z-index: 2;
        inset: 0;
        background: var(--app-primary-soft);
        content: "";
        pointer-events: none;
      }

      .column-resize-handle {
        position: absolute;
        z-index: 3;
        top: 0;
        right: -2px;
        bottom: -1px;
        width: 4px;
        background: var(--app-primary);
        pointer-events: none;
      }
    }

    &.resize-cursor {
      cursor: col-resize;
    }

    p.is-editor-empty:first-child::before {
      height: 0;
      float: left;
      color: var(--app-text-tertiary);
      content: attr(data-placeholder);
      pointer-events: none;
    }
  }

  :deep(.rich-text-editor-surface img) {
    display: block;
    width: 100%;
    max-width: 620px;
    height: auto;
    margin: 16px auto;
  }
}

.editor-meta {
  padding: 8px 14px;
  border-top: 1px solid var(--app-border-subtle);
  color: var(--app-text-tertiary);
  font-size: 12px;
  text-align: right;
}

@media (max-width: 768px) {
  .rich-text-editor.is-fullscreen {
    inset: 0;
    border: 0;
    border-radius: 0;
  }

  .editor-content :deep(.rich-text-editor-surface) {
    min-height: 260px;
    padding: 16px 16px 56px;
  }
}
</style>
