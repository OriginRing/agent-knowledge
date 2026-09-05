<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import { api, request, type ModelConfig } from "../api";
const rows = ref<ModelConfig[]>([]),
  loading = ref(false),
  saving = ref(false),
  open = ref(false);
const form = reactive<ModelConfig>({
  id: "",
  name: "",
  modelType: "ollama",
  modelName: "",
  baseUrl: "",
  apiKeyName: "",
  revision: 0,
});
async function load() {
  loading.value = true;
  try {
    rows.value = await api<ModelConfig[]>("/admin/models");
  } finally {
    loading.value = false;
  }
}
function edit(model?: ModelConfig) {
  Object.assign(
    form,
    model || {
      id: "",
      name: "",
      modelType: "ollama",
      modelName: "",
      baseUrl: "",
      apiKeyName: "",
      revision: 0,
    },
  );
  open.value = true;
}
async function save() {
  saving.value = true;
  try {
    await api(
      "/admin/models" + (form.id ? "/" + form.id : ""),
      request(form.id ? "PUT" : "POST", {
        draft: form,
        revision: form.revision,
      }),
    );
    message.success(
      form.id ? "模型配置已更新，引用它的智能体需重新发布" : "模型配置已创建",
    );
    open.value = false;
    await load();
  } catch (e) {
    message.error((e as Error).message);
  } finally {
    saving.value = false;
  }
}
function remove(model: ModelConfig) {
  Modal.confirm({
    title: `删除“${model.name}”？`,
    content: "被智能体使用的模型不能删除。",
    okText: "删除",
    cancelText: "取消",
    okButtonProps: { danger: true },
    async onOk() {
      await api(
        `/admin/models/${model.id}`,
        request("DELETE", { revision: model.revision }),
      );
      message.success("已删除");
      await load();
    },
  });
}
onMounted(load);
</script>
<template>
  <section class="page">
    <header class="page-heading">
      <h1>模型管理</h1>
      <a-button type="primary" size="large" @click="edit()"
        >＋ 创建模型</a-button
      >
    </header>
    <div class="page-content">
      <a-card
        ><a-table
          :loading="loading"
          :data-source="rows"
          row-key="id"
          :pagination="false"
        >
          <a-table-column title="配置名称" data-index="name" />
          <a-table-column title="来源"
            ><template #default="{ record }">{{
              record.modelType === "ollama" ? "本地 Ollama" : "云端 API"
            }}</template></a-table-column
          >
          <a-table-column title="模型名称" data-index="modelName" />
          <a-table-column title="服务地址"
            ><template #default="{ record }">{{
              record.baseUrl || "默认地址"
            }}</template></a-table-column
          >
          <a-table-column title="密钥变量"
            ><template #default="{ record }">{{
              record.apiKeyName || "—"
            }}</template></a-table-column
          >
          <a-table-column title="操作"
            ><template #default="{ record }"
              ><a-space
                ><a-button type="link" @click="edit(record)">编辑</a-button
                ><a-button type="link" danger @click="remove(record)"
                  >删除</a-button
                ></a-space
              ></template
            ></a-table-column
          >
        </a-table></a-card
      >
    </div>
    <a-modal
      v-model:open="open"
      :title="form.id ? '编辑模型' : '创建模型'"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="saving"
      @ok="save"
    >
      <a-form layout="vertical">
        <a-form-item label="配置名称" required
          ><a-input v-model:value="form.name" placeholder="例如：本地 Qwen 3.5"
        /></a-form-item>
        <a-form-item label="模型来源" required
          ><a-radio-group v-model:value="form.modelType" button-style="solid"
            ><a-radio-button value="ollama">本地 Ollama</a-radio-button
            ><a-radio-button value="api"
              >云端 API</a-radio-button
            ></a-radio-group
          ></a-form-item
        >
        <a-form-item label="模型名称" required
          ><a-input
            v-model:value="form.modelName"
            placeholder="例如 qwen3.5:9b"
        /></a-form-item>
        <a-form-item
          :label="form.modelType === 'ollama' ? 'Ollama 地址' : 'API 地址'"
          required
          ><a-input
            v-model:value="form.baseUrl"
            :placeholder="
              form.modelType === 'ollama'
                ? 'http://127.0.0.1:11434'
                : 'https://api.example.com/v1'
            "
        /></a-form-item>
        <a-form-item
          v-if="form.modelType === 'api'"
          label="密钥环境变量名"
          required
          extra="仅保存环境变量名，不保存真实密钥"
          ><a-input
            v-model:value="form.apiKeyName"
            placeholder="例如 OPENAI_API_KEY"
        /></a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>
