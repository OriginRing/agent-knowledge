<template>
  <section class="memory-editor-panel" aria-label="记忆编辑器">
    <header class="memory-panel-header">
      <h2>{{ isCorrection ? "订正记忆" : "新增记忆" }}</h2>
      <p v-if="!isCorrection">
        写下希望系统长期记住的偏好、习惯或重要信息。内容将以 Markdown 格式保存。
      </p>
    </header>

    <a-alert
      v-if="isCorrection"
      message="订正会话记忆"
      description="请写下准确的信息，系统会根据反馈更正这段会话产生的记忆。"
      type="warning"
      show-icon
    />

    <RichTextEditor
      class="memory-panel-editor"
      :disabled="chat.memoryUploadLoading"
      placeholder="请输入希望长期保留的偏好、习惯或重要信息"
      @update:markdown="memoryInput = $event"
    />

    <footer class="memory-panel-footer">
      <a-button
        :disabled="chat.memoryUploadLoading"
        @click="chat.closeWorkspacePanel()"
      >
        取消
      </a-button>
      <a-button
        type="primary"
        :loading="chat.memoryUploadLoading"
        :disabled="!memoryInput.trim()"
        @click="submitMemory"
      >
        {{ isCorrection ? "提交订正" : "上传记忆" }}
      </a-button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { message } from "ant-design-vue";
import httpClient from "@view/services/http";
import { useChatStore } from "@view/stores/chat";
import RichTextEditor from "@view/components/rich-text-editor/index.vue";

const chat = useChatStore();
const memoryInput = ref("");
const isCorrection = computed(() => Boolean(chat.memoryConversationId));

const submitMemory = async () => {
  const content = memoryInput.value.trim();
  if (!content || chat.memoryUploadLoading) return;

  chat.setMemoryUploadLoading(true);
  try {
    const response = isCorrection.value
      ? await httpClient.post("/auth/memory/update", {
          conversation_id: chat.memoryConversationId,
          feedback_content: content,
        })
      : await httpClient.post("/auth/memory/add", {
          conversation_id: chat.getUserDetail.username,
          messages: [{ role: "user", content }],
        });

    if (response.code !== 0) {
      message.error(
        response.message ||
          (isCorrection.value
            ? "记忆订正失败，请稍后重试"
            : "记忆添加失败，请稍后重试"),
      );
      return;
    }

    message.success(
      isCorrection.value ? "已对相关记忆进行订正" : "记忆添加成功",
    );
    chat.finishMemoryEditor();
  } catch (error) {
    console.log(error);
    message.error(
      isCorrection.value
        ? "记忆订正失败，请检查网络后重试"
        : "记忆添加失败，请检查网络后重试",
    );
  } finally {
    chat.setMemoryUploadLoading(false);
  }
};
</script>

<style scoped lang="less">
.memory-editor-panel {
  display: flex;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: 16px;
  padding: 22px 18px 16px;
}

.memory-panel-header {
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

.memory-panel-editor {
  min-height: 0;
  flex: 1;
}

.memory-panel-footer {
  display: flex;
  flex: none;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 2px;
}

@media (max-width: 768px) {
  .memory-editor-panel {
    padding: 18px 12px 12px;
  }
}
</style>
