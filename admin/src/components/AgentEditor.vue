<script setup lang="ts">
import { ref, watch } from "vue";
import JsonField from "./JsonField.vue";
import type { ModelConfig, Resource } from "../api";
const props = defineProps<{ workflows: Resource[]; models: ModelConfig[] }>();
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
          <a-form-item label="模型" required>
            <a-select
              v-model:value="draft.modelId"
              placeholder="选择模型配置"
              :options="
                props.models.map((model) => ({
                  label: model.name,
                  value: model.id,
                }))
              "
            />
          </a-form-item>
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
          v-for="cap in [{ key: 'think', label: '深度思考' }]"
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
        <p class="muted">Skill 能力由工作流配置，不受这里的能力开关控制。</p>
      </section>
    </div>
  </div>
</template>
