<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from "vue-router";
import { message, Modal } from "ant-design-vue";
import { api, request, type Kind, type Resource } from "../api";
import AgentEditor from "./AgentEditor.vue";
import WorkflowEditor from "./WorkflowEditor.vue";
import DebugPanel from "./DebugPanel.vue";
const route = useRoute(),
  router = useRouter();
const kind = computed(() => String(route.params.kind) as Kind);
const labels = {
  agents: "智能体开发",
  skills: "Skill 管理",
  workflows: "工作流配置",
};
const isWorkflowDetail = computed(
  () => kind.value === "workflows" && Boolean(route.params.id),
);
const rows = ref<Resource[]>([]),
  workflows = ref<Resource[]>([]),
  skills = ref<Resource[]>([]),
  agents = ref<Resource[]>([]);
const current = ref<Resource>(),
  draft = ref<Record<string, any>>({}),
  query = ref(""),
  busy = ref(false),
  error = ref(""),
  loading = ref(false),
  showDebug = ref(false),
  references = ref<string[]>([]),
  selectedVersion = ref<number>();
const baseline = ref("");
const invalidEditor = ref(false);
let loadId = 0;
function cleanDraft() {
  if (kind.value !== "workflows") return draft.value;
  return {
    name: draft.value.name,
    nodes: (draft.value.nodes || []).map((n: any) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: (draft.value.edges || []).map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle ?? null,
      targetHandle: e.targetHandle ?? null,
      type: "smoothstep",
    })),
  };
}
const serialized = () => JSON.stringify(cleanDraft());
const dirty = computed(
  () => !!current.value && serialized() !== baseline.value,
);
const filtered = computed(() =>
  rows.value.filter((row) =>
    `${row.name} ${row.draft.description || ""}`
      .toLowerCase()
      .includes(query.value.toLowerCase()),
  ),
);
const columns = computed(() => [
  { title: "名称", key: "name" },
  { title: "状态", key: "status", width: 160 },

  {
    title:
      kind.value === "agents"
        ? "模型"
        : kind.value === "skills"
          ? "类型"
          : "节点",
    key: "info",
    width: 200,
  },
  ...(kind.value === "workflows"
    ? [{ title: "使用智能体", key: "agentCount", width: 130 }]
    : []),
  { title: "操作", key: "actions", width: 220 },
]);
const selectedSkill = computed(() => current.value?.draft);
function blank(): Record<string, any> {
  if (kind.value === "agents")
    return {
      name: "未命名智能体",
      description: "",
      model_type: "ollama",
      model_name: "",
      base_url: "",
      api_key_name: "",
      system_prompt: "",
      slot: [],
      support_think: false,
      default_think: false,
      support_connect: false,
      default_connect: false,
      support_knowledge: false,
      default_knowledge: false,
      support_file: false,
      support_download: false,
      workflowId: null,
      workflowVersion: null,
    };
  return {
    name: "未命名工作流",
    nodes: [
      {
        id: "start",
        type: "start",
        position: { x: 70, y: 190 },
        data: { label: "用户输入" },
      },
      {
        id: "model",
        type: "model",
        position: { x: 350, y: 190 },
        data: { label: "模型回答", prompt: "", input: "{{input.text}}" },
      },
      {
        id: "end",
        type: "end",
        position: { x: 630, y: 190 },
        data: {
          label: "返回结果",
          answer: "{{nodes.model.output.text}}",
          artifacts: [],
        },
      },
    ],
    edges: [
      {
        id: "start-model",
        source: "start",
        target: "model",
        type: "smoothstep",
      },
      { id: "model-end", source: "model", target: "end", type: "smoothstep" },
    ],
  };
}
async function loadOptions(which: Kind) {
  const list = await api<Resource[]>("/admin/" + which);
  return Promise.all(
    list.map((r) => api<Resource>("/admin/" + which + "/" + r.id)),
  );
}
async function load() {
  const ticket = ++loadId;
  loading.value = true;
  error.value = "";
  try {
    const [list, flowOptions, skillOptions, agentOptions] = await Promise.all([
      api<Resource[]>("/admin/" + kind.value),
      loadOptions("workflows"),
      loadOptions("skills"),
      api<Resource[]>("/admin/agents"),
    ]);
    if (ticket !== loadId) return;
    rows.value = list;
    workflows.value = flowOptions;
    skills.value = skillOptions;
    agents.value = agentOptions;
    if (route.params.id) {
      const value =
        route.params.id === "new"
          ? ({
              id: "",
              kind: kind.value,
              name: "",
              revision: 0,
              draft: blank(),
              publishedVersion: null,
              online: false,
            } as Resource)
          : await api<Resource>(`/admin/${kind.value}/${route.params.id}`);
      if (ticket !== loadId) return;
      current.value = value;
      draft.value = structuredClone(value.draft);
      baseline.value = serialized();
      selectedVersion.value = value.publishedVersion || undefined;
    } else {
      current.value = undefined;
    }
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    if (ticket === loadId) loading.value = false;
  }
}
watch(() => route.params.id, load, { immediate: true });
watch(selectedVersion, async (value) => {
  if (kind.value === "skills" && current.value?.id && value) {
    try {
      references.value = await api(
        `/admin/skills/${current.value.id}/references`,
      );
    } catch (e) {
      error.value = (e as Error).message;
    }
  }
});
function confirmLeave() {
  return !dirty.value || window.confirm("草稿尚未保存，确定离开并丢弃修改吗？");
}
onBeforeRouteLeave(confirmLeave);
onBeforeRouteUpdate(confirmLeave);
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value) event.preventDefault();
}
window.addEventListener("beforeunload", beforeUnload);
onBeforeUnmount(() => {
  ++loadId;
  window.removeEventListener("beforeunload", beforeUnload);
});
async function navigate(id = "") {
  if (confirmLeave()) {
    baseline.value = serialized();
    await router.push("/" + kind.value + (id ? "/" + id : ""));
  }
}
async function save() {
  if (!current.value || invalidEditor.value) {
    error.value = "请先修正编辑器中的格式错误";
    return false;
  }
  busy.value = true;
  error.value = "";
  try {
    const saved = await api<Resource>(
      "/admin/" + kind.value + (current.value.id ? "/" + current.value.id : ""),
      request(current.value.id ? "PUT" : "POST", {
        draft: cleanDraft(),
        revision: current.value.revision,
      }),
    );
    current.value = saved;
    draft.value = structuredClone(saved.draft);
    baseline.value = serialized();
    if (route.params.id === "new")
      await router.replace("/" + kind.value + "/" + saved.id);
    message.success("草稿已保存");
    return true;
  } catch (e) {
    error.value = (e as Error).message;
    return false;
  } finally {
    busy.value = false;
  }
}
async function operation(action: "publish" | "offline" | "validate") {
  if (action !== "offline" && invalidEditor.value) {
    error.value = "请先修正编辑器中的格式错误";
    return;
  }
  if (
    !current.value?.id ||
    (action !== "offline" && dirty.value && !(await save()))
  )
    return;
  busy.value = true;
  error.value = "";
  try {
    await api(
      `/admin/${kind.value}/${current.value.id}/${action}`,
      request("POST", { revision: current.value.revision }),
    );
    message.success(
      {
        publish: "已发布",
        offline: "智能体已下线",
        validate: "工作流校验通过",
      }[action],
    );
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
function confirmPublish() {
  if (invalidEditor.value) {
    error.value = "请先修正编辑器中的格式错误";
    return;
  }
  Modal.confirm({
    title: "发布当前配置？",
    content: "发布最新智能体配置、工作流及 Skill。",
    okText: "发布",
    cancelText: "取消",
    onOk: () => operation("publish"),
  });
}
async function debug() {
  if (invalidEditor.value) {
    error.value = "请先修正编辑器中的格式错误";
    return;
  }
  if ((!current.value?.id || dirty.value) && !(await save())) return;
  showDebug.value = true;
}
async function upload(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0];
  if (!file) return;
  busy.value = true;
  error.value = "";
  try {
    const form = new FormData();
    form.append("file", file);
    await api("/admin/skills/upload", { method: "POST", body: form });
    message.success("Skill 已更新，相关智能体需重新发布");
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
    input.value = "";
  }
}
function deletionReason(row: Resource) {
  return row.kind === "agents" && row.online
    ? "请先下线智能体"
    : row.kind === "workflows" && (row.agentCount ?? 0) > 0
      ? `被 ${row.agentCount} 个智能体使用，不能删除`
      : "";
}
function deleteResource(row: Resource) {
  if (deletionReason(row)) return;
  Modal.confirm({
    title: `删除“${row.name}”？`,
    content: "删除后将从管理列表移除，历史记录保留。",
    okText: "删除",
    cancelText: "取消",
    okButtonProps: { danger: true },
    async onOk() {
      busy.value = true;
      try {
        await api(
          `/admin/${row.kind}/${row.id}`,
          request("DELETE", { revision: row.revision }),
        );
        message.success("已删除");
        await load();
      } catch (e) {
        error.value = (e as Error).message;
        throw e;
      } finally {
        busy.value = false;
      }
    },
  });
}
function deleteVersion() {
  Modal.confirm({
    title: "删除此 Skill？",
    content: "正在使用或被流程引用的 Skill 无法删除。",
    okText: "删除",
    cancelText: "取消",
    okButtonProps: { danger: true },
    async onOk() {
      try {
        await api(
          `/admin/skills/${current.value!.id}`,
          request("DELETE", { revision: current.value!.revision }),
        );
        baseline.value = serialized();
        await router.push("/skills");
        await load();
      } catch (e) {
        error.value = (e as Error).message;
      }
    },
  });
}
</script>
<template>
  <div class="page" :class="{ 'workflow-page': isWorkflowDetail }">
    <header class="page-heading">
      <div class="heading-main">
        <a-button v-if="current" type="text" class="back" @click="navigate()"
          >← 返回列表</a-button
        >
        <a-input
          v-if="isWorkflowDetail && current"
          v-model:value="draft.name"
          class="workflow-name"
          aria-label="工作流名称"
          :maxlength="100"
          :bordered="false"
        />
        <h1 v-else>
          {{ current ? current.name || draft.name : labels[kind] }}
        </h1>
        <a-tag
          v-if="current && kind !== 'skills'"
          :color="dirty ? 'orange' : 'default'"
          >{{ dirty ? "未保存修改" : "草稿编辑" }}</a-tag
        >
      </div>
      <a-space v-if="!current"
        ><label v-if="kind === 'skills'" class="upload-button"
          >{{ busy ? "正在上传…" : "＋ 上传 Skill"
          }}<input
            type="file"
            accept=".zip"
            :disabled="busy"
            @change="upload" /></label
        ><a-button v-else type="primary" size="large" @click="navigate('new')"
          >＋ {{ kind === "agents" ? "创建智能体" : "创建工作流" }}</a-button
        ></a-space
      >
      <a-space v-else-if="kind !== 'skills'" wrap
        ><a-button :loading="busy" @click="save">{{
          kind === "workflows" ? "保存" : "保存草稿"
        }}</a-button
        ><a-button
          v-if="kind === 'workflows'"
          :disabled="!current.id || busy"
          @click="operation('validate')"
          >校验</a-button
        ><a-button :disabled="busy" @click="debug">调试</a-button
        ><a-button
          v-if="kind === 'agents' && current.online"
          danger
          :disabled="busy"
          @click="operation('offline')"
          >下线</a-button
        ><a-button
          v-if="kind === 'agents'"
          type="primary"
          :disabled="!current.id || busy"
          @click="confirmPublish"
          >发布</a-button
        ></a-space
      >
    </header>
    <a-alert
      v-if="error"
      class="page-error"
      type="error"
      :message="error"
      show-icon
      closable
      @close="error = ''"
    />
    <a-spin :spinning="loading">
      <template v-if="!current"
        ><div class="overview-strip">
          <div>
            <strong>{{ rows.length }}</strong
            ><span>{{
              kind === "agents"
                ? "全部智能体"
                : kind === "skills"
                  ? "可用 Skill"
                  : "全部工作流"
            }}</span>
          </div>
          <div>
            <strong>{{ rows.filter((r) => r.online).length }}</strong
            ><span>已发布 / 可用</span>
          </div>
          <p>修改工作流或 Skill 后，相关智能体需要重新发布。</p>
        </div>
        <section class="list-card">
          <div class="list-toolbar">
            <h3>{{ labels[kind] }}列表</h3>
            <a-input-search
              v-model:value="query"
              placeholder="搜索名称或描述"
              allow-clear
              style="width: 280px"
            />
          </div>
          <a-table
            :columns="columns"
            :data-source="filtered"
            row-key="id"
            :pagination="{ pageSize: 10, showSizeChanger: false }"
            ><template #bodyCell="{ column, record }"
              ><template v-if="column.key === 'name'"
                ><a class="resource-name" @click="navigate(record.id)">{{
                  record.name
                }}</a>
                <p class="resource-description">
                  {{
                    record.draft.description ||
                    (kind === "workflows" ? "可视化执行流程" : "暂无描述")
                  }}
                </p></template
              ><template v-else-if="column.key === 'status'"
                ><a-tag :color="record.online ? 'green' : 'default'">{{
                  record.draft.needsPublish
                    ? "待重新发布"
                    : record.online
                      ? kind === "skills" && record.draft.builtin
                        ? "内置"
                        : "已发布"
                      : record.publishedVersion
                        ? "已下线"
                        : "未发布"
                }}</a-tag></template
              ><template v-else-if="column.key === 'info'">{{
                kind === "agents"
                  ? record.draft.model_name || "尚未配置"
                  : kind === "skills"
                    ? record.draft.kind
                    : (record.draft.nodes?.length || 0) + " 个节点"
              }}</template
              ><template v-else-if="column.key === 'agentCount'"
                >{{ record.agentCount ?? 0 }} 个</template
              ><template v-else-if="column.key === 'actions'"
                ><a-button type="link" @click="navigate(record.id)"
                  >{{ kind === "skills" ? "查看详情" : "编辑配置" }} →</a-button
                ><a-tooltip
                  v-if="kind !== 'skills'"
                  :title="deletionReason(record)"
                  ><span
                    ><a-button
                      type="link"
                      danger
                      :disabled="busy || !!deletionReason(record)"
                      @click="deleteResource(record)"
                      >删除</a-button
                    ></span
                  ></a-tooltip
                ></template
              ></template
            ><template #emptyText
              ><a-empty
                :description="
                  query ? '没有匹配的记录' : '从创建第一条记录开始'
                " /></template
          ></a-table></section
      ></template>
      <template v-else-if="kind === 'agents'"
        ><AgentEditor
          v-model="draft"
          :workflows="workflows"
          @invalid="invalidEditor = $event"
      /></template>
      <template v-else-if="kind === 'workflows'">
        <WorkflowEditor
          :key="current.id || 'new'"
          v-model="draft"
          :skills="skills"
          @invalid="invalidEditor = $event"
      /></template>
      <section v-else class="form-card skill-detail">
        <div class="list-toolbar">
          <h3>{{ current.name }}</h3>
          <a-space
            ><a-button
              v-if="!current.draft.builtin"
              danger
              @click="deleteVersion"
              >删除 Skill</a-button
            ></a-space
          >
        </div>
        <a-descriptions bordered :column="2"
          ><a-descriptions-item label="类型">{{
            selectedSkill?.kind
          }}</a-descriptions-item
          ><a-descriptions-item label="来源">{{
            selectedSkill?.builtin ? "内置（只读）" : "管理员上传"
          }}</a-descriptions-item
          ><a-descriptions-item label="执行入口">{{
            selectedSkill?.entrypoint || "提示词技能"
          }}</a-descriptions-item
          ><a-descriptions-item label="依赖状态">{{
            selectedSkill?.dependencyStatus
          }}</a-descriptions-item
          ><a-descriptions-item label="描述" :span="2">{{
            selectedSkill?.description
          }}</a-descriptions-item></a-descriptions
        >
        <h3>技能说明</h3>
        <pre>{{ selectedSkill?.prompt }}</pre>
        <h3>依赖声明</h3>
        <pre>{{
          selectedSkill?.dependencies || "未提供 requirements.txt"
        }}</pre>
        <h3>引用位置</h3>
        <ul v-if="references.length">
          <li v-for="reference in references" :key="reference">
            {{ reference }}
          </li>
        </ul>
        <p v-else class="muted">暂无工作流引用</p>
      </section>
    </a-spin>
    <a-drawer
      v-model:open="showDebug"
      title="草稿调试"
      width="620"
      :destroy-on-close="true"
      ><DebugPanel
        v-if="showDebug"
        :agents="agents"
        :agent-id="kind === 'agents' ? current?.id : undefined"
        :workflow-id="kind === 'workflows' ? current?.id : undefined"
    /></a-drawer>
  </div>
</template>
