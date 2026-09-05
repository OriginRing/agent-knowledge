<script setup lang="ts">
import { computed, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import { api, request } from "../api";
interface DocumentResult {
  fileName: string;
  fileUrl: string;
  fileContent: string | string[];
  createdAt?: string;
  sourceLabel?: string;
}
const query = ref("");
const results = ref<DocumentResult[]>([]);
const searching = ref(false),
  uploading = ref(false),
  clearing = ref(false);
const open = ref(false),
  mode = ref("file"),
  file = ref<File>();
const name = ref(""),
  url = ref(""),
  error = ref("");
let searchVersion = 0;
const uploadReady = computed(() =>
  mode.value === "file"
    ? Boolean(file.value)
    : Boolean(name.value.trim() && /^https?:\/\//i.test(url.value.trim())),
);
async function search() {
  if (!query.value.trim() || clearing.value) return;
  const version = ++searchVersion;
  searching.value = true;
  error.value = "";
  try {
    const value = await api<DocumentResult[]>(
      "/admin/knowledge/search",
      request("POST", { search: query.value.trim() }),
    );
    if (version === searchVersion) results.value = value;
  } catch (e) {
    if (version === searchVersion) error.value = (e as Error).message;
  } finally {
    if (version === searchVersion) searching.value = false;
  }
}
function selectFile(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0];
}
function close() {
  if (uploading.value) return;
  open.value = false;
  file.value = undefined;
  name.value = "";
  url.value = "";
}
async function upload() {
  if (!uploadReady.value || uploading.value) return;
  uploading.value = true;
  try {
    const form = new FormData();
    if (file.value) form.append("file", file.value);
    const result = await api(
      mode.value === "file"
        ? "/admin/knowledge/file"
        : "/admin/knowledge/upload",
      mode.value === "file"
        ? { method: "POST", body: form }
        : request("POST", {
            fileName: name.value.trim(),
            url: url.value.trim(),
          }),
    );
    if (result?.warnings?.length)
      message.warning(`上传完成，${result.warnings.length} 项内容解析不完整`);
    else message.success("已上传到知识库");
    uploading.value = false;
    close();
    if (query.value.trim()) await search();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    uploading.value = false;
  }
}
function confirmClear() {
  Modal.confirm({
    title: "清空知识库？",
    content:
      "将删除全部知识库索引内容，所有智能体将无法检索这些资料。此操作无法撤销。",
    okText: "确认清空",
    cancelText: "取消",
    okType: "danger",
    async onOk() {
      clearing.value = true;
      ++searchVersion;
      searching.value = false;
      try {
        await api("/admin/knowledge/clear", request("POST"));
        results.value = [];
        error.value = "";
        message.success("知识库已清空");
      } catch (e) {
        message.error((e as Error).message);
        throw e;
      } finally {
        clearing.value = false;
      }
    },
  });
}
function safeUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : undefined;
}
</script>
<template>
  <section class="page knowledge-page">
    <header class="page-heading">
      <h1>知识库管理</h1>
      <a-space>
        <a-button
          danger
          :loading="clearing"
          :disabled="uploading"
          @click="confirmClear"
          >清空知识库</a-button
        >
        <a-button type="primary" :disabled="clearing" @click="open = true"
          >上传知识库</a-button
        >
      </a-space>
    </header>
    <div class="page-content">
      <a-card>
        <a-input-search
          v-model:value="query"
          placeholder="输入关键词检索知识库"
          enter-button="检索"
          :loading="searching"
          :disabled="clearing"
          @search="search"
        />
        <a-alert
          v-if="error"
          type="error"
          show-icon
          :message="error"
          class="result-item"
        />
        <a-spin :spinning="searching">
          <div class="knowledge-results">
            <a-empty v-if="!results.length" description="暂无检索结果" />
            <a-card
              v-for="(item, index) in results"
              :key="index"
              size="small"
              class="result-item"
            >
              <template #title
                ><a
                  :href="safeUrl(item.fileUrl)"
                  target="_blank"
                  rel="noopener noreferrer"
                  >{{ item.fileName }}</a
                ></template
              >
              <template #extra
                ><span v-if="item.createdAt">{{
                  item.createdAt
                }}</span></template
              >
              <a-tag v-if="item.sourceLabel" color="blue">{{
                item.sourceLabel
              }}</a-tag>
              <p class="result-content">
                {{
                  Array.isArray(item.fileContent)
                    ? item.fileContent.join("\n")
                    : item.fileContent
                }}
              </p>
            </a-card>
          </div>
        </a-spin>
      </a-card>
    </div>
    <a-modal
      :open="open"
      title="上传知识库"
      :confirm-loading="uploading"
      :closable="!uploading"
      :mask-closable="!uploading"
      :keyboard="!uploading"
      :cancel-button-props="{ disabled: uploading }"
      :ok-button-props="{ disabled: !uploadReady }"
      ok-text="上传"
      cancel-text="取消"
      destroy-on-close
      @ok="upload"
      @cancel="close"
    >
      <a-tabs v-model:active-key="mode">
        <a-tab-pane key="file" tab="文件上传" :disabled="uploading">
          <input
            type="file"
            aria-label="选择知识库文件"
            :disabled="uploading"
            @change="selectFile"
          />
          <p class="muted">
            支持现有文档、图片等解析格式；图片最大 5 MB，其他文件最大 10 MB。
          </p>
        </a-tab-pane>
        <a-tab-pane key="url" tab="URL" :disabled="uploading">
          <a-form layout="vertical">
            <a-form-item label="文件名" required
              ><a-input v-model:value="name" :disabled="uploading"
            /></a-form-item>
            <a-form-item label="文件 URL" required
              ><a-input
                v-model:value="url"
                placeholder="https://"
                :disabled="uploading"
            /></a-form-item>
          </a-form>
        </a-tab-pane>
      </a-tabs>
    </a-modal>
  </section>
</template>
<style scoped>
.knowledge-results {
  margin-top: 24px;
}
.result-item {
  margin-top: 16px;
}
.result-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 12px 0 0;
}
input[type="file"] {
  margin: 16px 0;
  max-width: 100%;
}
</style>
