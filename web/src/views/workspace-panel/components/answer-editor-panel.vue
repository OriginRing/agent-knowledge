<template>
  <section class="answer-editor-panel" aria-label="回答编辑器">
    <header class="answer-panel-header">
      <h2>编辑回答</h2>
      <p>调整回答内容后，可将当前版本下载为 DOCX 文件。</p>
    </header>

    <RichTextEditor
      class="answer-panel-editor"
      :initial-content="chat.answerDraft?.content || ''"
      initial-format="html"
      placeholder="请输入回答内容"
      @update:html="answerHtml = $event"
    />

    <footer class="answer-panel-footer">
      <a-button @click="chat.closeWorkspacePanel()">取消</a-button>
      <a-button
        type="primary"
        :disabled="!answerHtml.trim()"
        @click="downloadAnswer"
      >
        <template #icon><DownloadOutlined /></template>
        下载 DOCX
      </a-button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { DownloadOutlined } from "@ant-design/icons-vue";
import RichTextEditor from "@view/components/rich-text-editor/index.vue";
import { useChatStore } from "@view/stores/chat";
import { saveHtmlAsDocx } from "@view/utils/save-file";

const chat = useChatStore();
const answerHtml = ref("");

const downloadAnswer = async () => {
  if (!answerHtml.value.trim()) return;
  await saveHtmlAsDocx(
    answerHtml.value,
    `智能体回答-${chat.answerDraft?.id || Date.now()}.docx`,
  );
};
</script>

<style scoped lang="less">
.answer-editor-panel {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding: 22px 18px 16px;
}

.answer-panel-header {
  min-width: 0;
  padding-right: 46px;

  h2 {
    margin: 0;
    color: var(--app-text);
    font-size: 20px;
    line-height: 1.4;
  }

  p {
    margin: 7px 0 0;
    color: var(--app-text-secondary);
    font-size: 13px;
    line-height: 1.65;
  }
}

.answer-panel-editor {
  min-height: 0;
  flex: 1;
}

.answer-panel-footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

@media (max-width: 768px) {
  .answer-editor-panel {
    padding: 18px 12px 12px;
  }
}
</style>
