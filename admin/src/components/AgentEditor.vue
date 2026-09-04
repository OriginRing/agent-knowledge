<script setup lang="ts">
import { ref, watch } from "vue";
import JsonField from "./JsonField.vue";
import type { Resource } from "../api";
const props = defineProps<{ workflows: Resource[] }>();
const draft = defineModel<Record<string, any>>({ required: true });
const error = ref("");
const emit = defineEmits<{ invalid: [boolean] }>();
watch(error, (value) => emit("invalid", Boolean(value)));
function slots(value: unknown) {
  if (!Array.isArray(value)) {
    error.value = "词槽必须为数组";
    return;
  }
  draft.value.slot = value;
  error.value = "";
}
</script>
<template>
  <div class="agent-editor">
    <section class="form-card">
      <div class="section-heading">
        <span>01</span>
        <h3>基础信息</h3>
      </div>
      <a-form layout="vertical">
        <a-form-item label="智能体名称" required
          ><a-input
            v-model:value="draft.name"
            :maxlength="100"
            placeholder="为智能体取一个名字"
        /></a-form-item>
        <a-form-item label="描述"
          ><a-textarea
            v-model:value="draft.description"
            :rows="2"
            placeholder="它能帮助用户完成什么？"
        /></a-form-item>
        <a-form-item label="系统提示词"
          ><a-textarea
            v-model:value="draft.system_prompt"
            :rows="7"
            placeholder="定义角色、目标与回答要求"
        /></a-form-item>
        <a-form-item
          label="词槽模板（JSON）"
          extra='格式：[ { "title": "示例标题", "content": "提问内容" } ]'
          ><JsonField
            :value="draft.slot || []"
            :rows="4"
            @update:value="slots"
            @invalid="
              (value) => {
                if (value) error = '请修正词槽 JSON 格式';
              }
            " /></a-form-item
        ><a-alert v-if="error" type="error" :message="error" />
      </a-form>
    </section>
    <div>
      <section class="form-card">
        <div class="section-heading">
          <span>02</span>
          <h3>模型与工作流</h3>
        </div>
        <a-form layout="vertical">
          <a-form-item label="模型来源"
            ><a-radio-group
              v-model:value="draft.model_type"
              button-style="solid"
              ><a-radio-button value="ollama">本地 Ollama</a-radio-button
              ><a-radio-button value="api"
                >云端 API</a-radio-button
              ></a-radio-group
            ></a-form-item
          >
          <a-form-item label="模型名称" required
            ><a-input
              v-model:value="draft.model_name"
              placeholder="例如 qwen3.5:9b"
          /></a-form-item>
          <a-form-item
            :label="draft.model_type === 'ollama' ? 'Ollama 地址' : 'API 地址'"
            :extra="
              draft.model_type === 'ollama'
                ? '留空使用 http://127.0.0.1:11434'
                : '填写兼容 OpenAI 协议的基础地址'
            "
            ><a-input v-model:value="draft.base_url"
          /></a-form-item>
          <a-form-item
            v-if="draft.model_type === 'api'"
            label="密钥环境变量名"
            extra="真实 API Key 由部署人员配置，管理端不保存密钥。"
            ><a-input
              v-model:value="draft.api_key_name"
              placeholder="例如 QWEN_API_KEY"
          /></a-form-item>
          <a-form-item label="执行工作流" required
            ><a-select
              v-model:value="draft.workflowId"
              placeholder="选择工作流"
              :options="
                props.workflows
                  .filter((w) => w.publishedVersion)
                  .map((w) => ({ label: w.name, value: w.id }))
              "
          /></a-form-item>
          <a-alert
            v-if="draft.legacy"
            type="info"
            message="当前沿用原执行流程。首次发布管理端配置前，请选择工作流。"
            show-icon
          />
        </a-form>
      </section>
      <section class="form-card">
        <div class="section-heading">
          <span>03</span>
          <h3>能力配置</h3>
        </div>
        <div class="capability-header">
          <span>能力</span><span>支持</span><span>默认开启</span>
        </div>
        <div
          v-for="cap in [
            { key: 'think', label: '深度思考' },
            { key: 'connect', label: '联网搜索' },
            { key: 'knowledge', label: '知识库' },
          ]"
          :key="cap.key"
          class="capability-row"
        >
          <span>{{ cap.label }}</span
          ><a-switch
            v-model:checked="draft['support_' + cap.key]"
            :aria-label="'支持' + cap.label"
            @change="
              !draft['support_' + cap.key] &&
              (draft['default_' + cap.key] = false)
            "
          /><a-switch
            v-model:checked="draft['default_' + cap.key]"
            :disabled="!draft['support_' + cap.key]"
            :aria-label="'默认开启' + cap.label"
          />
        </div>
        <div class="simple-capability">
          <span>文件输入</span
          ><a-switch
            v-model:checked="draft.support_file"
            aria-label="支持文件输入"
          />
        </div>
        <div class="simple-capability">
          <span>产物生成</span
          ><a-switch
            v-model:checked="draft.support_download"
            aria-label="支持产物生成"
          />
        </div>
        <p class="muted">用户只能在允许的能力范围内切换。</p>
      </section>
    </div>
  </div>
</template>
