<script setup lang="ts">
import { onBeforeUnmount, ref } from "vue";
import type { ModelConfig, Resource } from "../api";
import { readEvents } from "../sse";
const props = defineProps<{
  agents: Resource[];
  models: ModelConfig[];
  agentId?: string;
  workflowId?: string;
}>();
const selected = ref(""),
  text = ref(""),
  fileText = ref(""),
  events = ref<any[]>([]),
  busy = ref(false),
  error = ref("");
let controller: AbortController | undefined;
function cancel() {
  controller?.abort();
}
onBeforeUnmount(cancel);
async function run() {
  controller = new AbortController();
  busy.value = true;
  error.value = "";
  events.value = [];
  try {
    const response = await fetch("/admin/debug", {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: props.agentId || undefined,
        modelId: props.workflowId ? selected.value : undefined,
        workflowId: props.workflowId,
        text: text.value,
        files: fileText.value
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.message || body.detail || "调试失败");
    }
    if (!response.body) throw new Error("服务器未返回调试数据流");
    for await (const event of readEvents(response.body))
      events.value.push(event);
  } catch (e) {
    error.value =
      (e as Error).name === "AbortError"
        ? "调试已取消，后续节点不会执行"
        : (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <a-alert
    message="调试使用已保存的草稿。结果独立记录，不进入用户对话历史。执行型 Skill 可能产生实际业务操作或文件。"
    type="info"
    show-icon
  />
  <a-form layout="vertical" class="debug-form"
    ><a-form-item
      :label="props.workflowId ? '调试模型' : '调试智能体'"
      required
      ><a-select
        v-if="props.workflowId"
        v-model:value="selected"
        :disabled="busy"
        placeholder="请选择模型"
        :options="models.map((model) => ({ label: model.name, value: model.id }))"
      />
      <a-select
        v-else
        :value="props.agentId"
        disabled
        :options="agents.map((agent) => ({ label: agent.name, value: agent.id }))"
      /></a-form-item
    ><a-form-item label="测试输入" required
      ><a-textarea v-model:value="text" :rows="3" /></a-form-item
    ><a-form-item label="文件 URL（每行一个，可选）"
      ><a-textarea v-model:value="fileText" :rows="2" /></a-form-item
    ><a-space
      ><a-button
        type="primary"
        :disabled="!(props.workflowId ? selected : props.agentId) || !text || busy"
        @click="run"
        >开始调试</a-button
      ><a-button v-if="busy" @click="cancel">停止</a-button
      ><a-spin v-if="busy" /></a-space
  ></a-form>
  <a-alert v-if="error" :message="error" type="error" show-icon />
  <div class="debug-events">
    <template v-for="(event, index) in events" :key="index"
      ><details v-if="event.node" :open="event.node.status === 'error'">
        <summary>
          <a-tag
            :color="
              event.node.status === 'error'
                ? 'red'
                : event.node.status === 'success'
                  ? 'green'
                  : 'blue'
            "
            >{{ event.node.status }}</a-tag
          >{{ event.node.title }}
          <span class="muted">{{
            event.node.details?.elapsedMs == null
              ? ""
              : event.node.details.elapsedMs + " ms"
          }}</span>
        </summary>
        <pre>{{ JSON.stringify(event.node.details, null, 2) }}</pre>
      </details>
      <a-alert v-if="event.error" :message="event.error" type="error" />
      <div v-if="event.content" class="debug-answer">
        <strong>最终回答</strong>
        <pre>{{ event.content }}</pre>
        <pre v-if="event.artifacts?.length">{{
          JSON.stringify(event.artifacts, null, 2)
        }}</pre>
      </div></template
    >
  </div>
</template>
