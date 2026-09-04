<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useThemeStore } from "@view/stores/theme";
import { copyToClipboard } from "@view/utils/copy";
import type * as Monaco from "monaco-editor";

const props = defineProps<{ modelValue: string; language: string }>();
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const theme = useThemeStore();
const container = ref<HTMLDivElement>();
const loading = ref(true);
const failed = ref(false);
let monaco: typeof Monaco | undefined;
let editor: Monaco.editor.IStandaloneCodeEditor | undefined;
let model: Monaco.editor.ITextModel | undefined;
let subscription: Monaco.IDisposable | undefined;
let disposed = false;
const resolveLanguage = () => {
  const language = props.language.trim().toLowerCase();
  const aliases: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    py: "python",
    sh: "shell",
    bash: "shell",
    yml: "yaml",
    md: "markdown",
    cs: "csharp",
    "c++": "cpp",
    vue: "html",
    text: "plaintext",
    txt: "plaintext",
  };
  const id = aliases[language] ?? language;
  return monaco?.languages.getLanguages().some((item) => item.id === id)
    ? id
    : "plaintext";
};
const loadEditor = async () => {
  loading.value = true;
  failed.value = false;
  try {
    const module = await import("@view/utils/monaco");
    if (disposed || !container.value) return;
    monaco = module.monaco;
    model = monaco.editor.createModel(props.modelValue, resolveLanguage());
    editor = monaco.editor.create(container.value, {
      model,
      theme: theme.isDark ? "vs-dark" : "vs",
      automaticLayout: true,
      minimap: { enabled: false },
      fontSize: 14,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      tabSize: 2,
      padding: { top: 16 },
      ariaLabel: "代码编辑器",
    });
    subscription = editor.onDidChangeModelContent(() =>
      emit("update:modelValue", editor!.getValue()),
    );
  } catch (error) {
    console.error("加载代码编辑器失败", error);
    failed.value = true;
  } finally {
    loading.value = false;
  }
};
watch(
  () => theme.isDark,
  (dark) => monaco?.editor.setTheme(dark ? "vs-dark" : "vs"),
);
watch(
  () => props.language,
  () => {
    if (model && monaco)
      monaco.editor.setModelLanguage(model, resolveLanguage());
  },
);
watch(
  () => props.modelValue,
  (value) => {
    if (model && model.getValue() !== value) model.setValue(value);
  },
);
onMounted(loadEditor);
onBeforeUnmount(() => {
  disposed = true;
  subscription?.dispose();
  editor?.dispose();
  model?.dispose();
});
</script>
<template>
  <div class="code-editor">
    <div class="editor-toolbar">
      <span class="language" :title="language">{{ language || "text" }}</span>
      <a-button size="small" @click="copyToClipboard(modelValue)"
        >复制代码</a-button
      >
    </div>
    <div class="editor-content">
      <div ref="container" class="editor-container" />
      <div v-if="loading" class="editor-status" role="status">
        正在加载编辑器…
      </div>
      <div v-else-if="failed" class="editor-status" role="alert">
        编辑器加载失败 <a-button @click="loadEditor">重试</a-button>
      </div>
    </div>
    <footer>修改保留在当前面板草稿中，可复制使用。</footer>
  </div>
</template>
<style scoped>
.code-editor {
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--app-border-subtle);
}
.language {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
}
.editor-content {
  position: relative;
  flex: 1;
  min-height: 0;
}
.editor-container {
  position: absolute;
  inset: 0;
}
.editor-status {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--app-surface);
}
footer {
  padding: 8px 16px;
  font-size: 12px;
  color: var(--app-text-secondary);
  border-top: 1px solid var(--app-border-subtle);
}
</style>
