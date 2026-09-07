<script setup lang="ts">
import { computed, ref, reactive, watch } from "vue";
import JsonField from "./JsonField.vue";
import {
  VueFlow,
  useVueFlow,
  type Node,
  type Edge,
  type Connection,
} from "@vue-flow/core";
import { Background } from "@vue-flow/background";
import { Controls } from "@vue-flow/controls";
import "@vue-flow/core/dist/style.css";
import "@vue-flow/core/dist/theme-default.css";
import "@vue-flow/controls/dist/style.css";
import FlowNode from "./FlowNode.vue";
import type { Resource } from "../api";
const props = defineProps<{ skills: Resource[] }>();
const graph = defineModel<Record<string, any>>({ required: true });
const { screenToFlowCoordinate } = useVueFlow();
const nodes = computed({
  get: () => graph.value.nodes as Node[],
  set: (value) => (graph.value.nodes = value),
});
const edges = computed({
  get: () => graph.value.edges as Edge[],
  set: (value) => (graph.value.edges = value),
});
const selectedId = ref("");
const emit = defineEmits<{ invalid: [boolean] }>();
const errors = reactive<Record<string, boolean>>({});
watch(
  () => Object.values(errors).some(Boolean),
  (value) => emit("invalid", value),
);
const selected = computed(() =>
  nodes.value.find((n) => n.id === selectedId.value),
);
const selectedSkill = computed(() =>
  props.skills.find((skill) => skill.id === selected.value?.data.skillId),
);
const skillPrompt = computed({
  get: () => {
    if (!selected.value || selected.value.type !== "skill") return "";
    return "prompt" in selected.value.data
      ? selected.value.data.prompt
      : selectedSkill.value?.draft.prompt || "";
  },
  set: (value: string) => {
    if (selected.value?.type === "skill") selected.value.data.prompt = value;
  },
});
const skillPromptModified = computed(
  () => selected.value?.type === "skill" && "prompt" in selected.value.data,
);
const referenceNodes = computed(() =>
  nodes.value.filter((node) => node.id !== selectedId.value),
);
const kinds = [
  { type: "start", label: "开始" },
  { type: "model", label: "模型" },
  { type: "skill", label: "Skill" },
  { type: "condition", label: "条件分支" },
  { type: "end", label: "结束" },
];
const defaults: Record<string, any> = {
  start: {},
  model: { prompt: "", input: "{{input.text}}" },
  skill: {
    skillId: "",
    skillVersion: null,
    arguments: { query: "{{input.text}}" },
  },
  condition: { left: "{{input.text}}", operator: "contains", right: "" },
  end: { answer: "", artifacts: [] },
};
function add(
  type: string,
  position = {
    x: 160 + nodes.value.length * 40,
    y: 150 + nodes.value.length * 30,
  },
) {
  const id = type + "-" + Math.random().toString(36).slice(2, 9);
  nodes.value = [
    ...nodes.value,
    {
      id,
      type,
      position,
      data: {
        label: kinds.find((k) => k.type === type)?.label,
        ...structuredClone(defaults[type]),
      },
    },
  ];
  selectedId.value = id;
}
function connect(connection: Connection) {
  edges.value = [
    ...edges.value,
    {
      ...connection,
      id: "e-" + Math.random().toString(36).slice(2, 10),
      type: "smoothstep",
    },
  ];
}
function drop(event: DragEvent) {
  const type = event.dataTransfer?.getData("application/agent-node");
  if (type && kinds.some((k) => k.type === type))
    add(type, screenToFlowCoordinate({ x: event.clientX, y: event.clientY }));
}
function drag(event: DragEvent, type: string) {
  event.dataTransfer?.setData("application/agent-node", type);
}
function remove() {
  nodes.value = nodes.value.filter((n) => n.id !== selectedId.value);
  edges.value = edges.value.filter(
    (e) => e.source !== selectedId.value && e.target !== selectedId.value,
  );
  selectedId.value = "";
}
function selectSkill(skillId: string) {
  if (selected.value?.type !== "skill") return;
  selected.value.data.skillId = skillId;
  selected.value.data.skillVersion = null;
  delete selected.value.data.prompt;
}
function resetSkillPrompt() {
  if (selected.value?.type === "skill") delete selected.value.data.prompt;
}
</script>
<template>
  <div class="workflow-editor">
    <aside class="node-library">
      <h4>节点库</h4>
      <p class="muted">拖入画布或点击添加</p>
      <button
        v-for="kind in kinds"
        :key="kind.type"
        draggable="true"
        @dragstart="drag($event, kind.type)"
        @click="add(kind.type)"
      >
        <span class="node-symbol">{{ kind.label.slice(0, 1) }}</span
        >{{ kind.label }}<span class="muted">＋</span>
      </button>
      <div class="canvas-help">
        选中连线后按 Delete 删除。<br />条件节点分别连接“是”和“否”出口。
      </div>
    </aside>
    <div class="canvas" @dragover.prevent @drop.prevent="drop">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        fit-view-on-init
        :delete-key-code="['Backspace', 'Delete']"
        @connect="connect"
        @node-click="selectedId = $event.node.id"
      >
        <template
          v-for="kind in kinds"
          :key="kind.type"
          #[`node-${kind.type}`]="nodeProps"
        >
          <FlowNode
            v-bind="nodeProps"
            :data="nodeProps.data"
            :type="kind.type"
          />
        </template>
        <Background :gap="20" pattern-color="#d9dde7" /><Controls />
      </VueFlow>
      <div class="canvas-badge">
        {{ nodes.length }} 个节点 · {{ edges.length }} 条连线
      </div>
    </div>
    <aside class="node-properties">
      <h4>节点属性</h4>
      <div v-if="!selected" class="empty-properties">
        选择画布中的节点<br />配置输入与执行行为
      </div>
      <a-form v-else :key="selected.id" layout="vertical">
        <a-form-item label="节点名称"
          ><a-input v-model:value="selected.data.label"
        /></a-form-item>
        <p class="muted">ID：{{ selected.id }}</p>
        <template v-if="selected.type === 'model'"
          ><a-form-item label="系统提示词"
            ><a-textarea
              v-model:value="selected.data.prompt"
              :rows="4" /></a-form-item
          ><a-form-item label="输入"
            ><a-textarea
              v-model:value="selected.data.input"
              :rows="3" /></a-form-item
        ></template>
        <template v-if="selected.type === 'skill'"
          ><a-form-item label="Skill"
            ><a-select
              :value="selected.data.skillId"
              :options="
                props.skills.map((s) => ({
                  label: s.name,
                  value: s.id,
                  skill: s.draft,
                }))
              "
              @change="selectSkill"
            >
              <template #option="option">
                <a-popover
                  placement="left"
                  :trigger="['hover', 'focus']"
                  :mouse-enter-delay="0.25"
                >
                  <template #title>{{ option.label }}</template>
                  <template #content>
                    <div class="skill-option-details">
                      <p>{{ option.skill.description || "暂无描述" }}</p>
                      <p>
                        类型：{{ option.skill.kind }} ·
                        {{ option.skill.builtin ? "内置" : "上传" }}
                      </p>
                      <p>入口：{{ option.skill.entrypoint || "提示词技能" }}</p>
                      <p>
                        依赖：{{ option.skill.dependencies || "未声明依赖" }}
                      </p>
                      <p>
                        适用智能体：{{
                          option.skill.agent_codes?.length
                            ? option.skill.agent_codes.join("、")
                            : "全部智能体"
                        }}
                      </p>
                      <pre>{{ option.skill.prompt || "暂无技能说明" }}</pre>
                    </div>
                  </template>
                  <span class="skill-option-label" tabindex="0">{{
                    option.label
                  }}</span>
                </a-popover>
              </template>
            </a-select></a-form-item
          ><a-form-item
            ><template #label
              ><span class="field-label"
                >调用参数（JSON）<a-tooltip
                  placement="left"
                  :trigger="['hover', 'focus']"
                >
                  <template #title>
                    <div class="variable-reference-content">
                      <strong>变量引用</strong
                      ><code v-pre>{{ input.text }}</code
                      ><code v-pre>{{ input.files }}</code
                      ><code v-for="n in referenceNodes" :key="n.id">{{
                        "\{\{nodes." +
                        n.id +
                        ".output" +
                        (n.type === "model" ? ".text" : "") +
                        "\}\}"
                      }}</code
                      ><small>只能引用所有执行路径上必经的上游节点。</small>
                    </div>
                  </template>
                  <button
                    class="field-help"
                    type="button"
                    aria-label="查看调用参数可用的变量引用"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 10.8v6M12 7.4h.01" />
                    </svg></button></a-tooltip></span></template
            ><JsonField
              v-model:value="selected.data.arguments"
              :rows="4"
              @invalid="
                (value) => (errors['arguments'] = value)
              " /></a-form-item
          ><a-form-item v-if="selected.data.skillId"
            ><template #label
              ><span class="prompt-label"
                ><span>Skill 提示词</span
                ><a-button
                  type="link"
                  size="small"
                  aria-label="重置 Skill 提示词"
                  :disabled="!skillPromptModified"
                  @click="resetSkillPrompt"
                  >重置</a-button
                ></span
              ></template
            ><a-textarea
              v-model:value="skillPrompt"
              :rows="10"
              placeholder="当前 Skill 未提供提示词"
            />
            <p class="prompt-help">
              默认读取当前 Skill 的 SKILL.md；修改后随工作流保存并用于执行。
            </p></a-form-item
          ></template
        >
        <template v-if="selected.type === 'condition'"
          ><a-form-item label="比较字段 / 变量"
            ><a-input v-model:value="selected.data.left" /></a-form-item
          ><a-form-item label="运算符"
            ><a-select
              v-model:value="selected.data.operator"
              :options="[
                { label: '等于', value: 'eq' },
                { label: '不等于', value: 'ne' },
                { label: '包含', value: 'contains' },
                { label: '大于', value: 'gt' },
                { label: '大于等于', value: 'gte' },
                { label: '小于', value: 'lt' },
                { label: '小于等于', value: 'lte' },
                { label: '存在', value: 'exists' },
              ]" /></a-form-item
          ><a-form-item label="比较值（JSON：字符串需加引号）"
            ><JsonField
              v-model:value="selected.data.right"
              :rows="4"
              @invalid="(value) => (errors['right'] = value)" /></a-form-item
        ></template>
        <template v-if="selected.type === 'end'"
          ><a-form-item label="回答内容 / 引用"
            ><a-textarea
              v-model:value="selected.data.answer"
              :rows="4" /></a-form-item
          ><a-form-item label="产物数组 / 引用（JSON）"
            ><JsonField
              v-model:value="selected.data.artifacts"
              :rows="4"
              @invalid="
                (value) => (errors['artifacts'] = value)
              " /></a-form-item
        ></template>
        <a-button danger block @click="remove">删除节点</a-button>
      </a-form>
    </aside>
  </div>
</template>

<style scoped>
.skill-option-label {
  display: block;
  width: 100%;
}
.skill-option-details {
  width: 340px;
  max-height: 360px;
  overflow: auto;
  overflow-wrap: anywhere;
}
.skill-option-details pre {
  white-space: pre-wrap;
  font: inherit;
  margin-bottom: 0;
}
.field-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.field-help {
  display: inline-grid;
  width: 24px;
  height: 24px;
  padding: 4px;
  place-items: center;
  color: #747c90;
  background: transparent;
  border: 0;
  border-radius: 5px;
}
.field-help:hover,
.field-help:focus-visible {
  color: #6848ed;
  background: #f0edff;
}
.field-help svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-width: 1.8;
}
.variable-reference-content {
  display: grid;
  gap: 7px;
  max-width: 300px;
}
.variable-reference-content code {
  overflow-wrap: anywhere;
  color: #d9ceff;
}
.variable-reference-content small {
  color: #d8dbe4;
  line-height: 1.6;
}
.prompt-label {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: space-between;
}
.prompt-label .ant-btn {
  height: 24px;
  padding-inline: 4px;
}
.prompt-help {
  margin: 6px 0 0;
  color: #747c90;
  font-size: 11px;
  line-height: 1.6;
}
</style>
