<script setup lang="ts">
import { Handle, Position } from "@vue-flow/core";
defineProps<{ type: string; data: Record<string, any>; selected?: boolean }>();
const names: Record<string, string> = {
  start: "开始",
  model: "模型",
  skill: "Skill",
  condition: "条件分支",
  end: "结束",
};
</script>
<template>
  <div class="flow-node" :class="[type, { selected }]">
    <Handle v-if="type !== 'start'" type="target" :position="Position.Left" />
    <span class="node-kind">{{ names[type] }}</span
    ><strong>{{ data.label || names[type] }}</strong>
    <small>{{
      type === "model"
        ? "继承智能体模型"
        : type === "skill"
          ? data.skillId || "请选择 Skill"
          : type === "condition"
            ? "按条件选择执行路径"
            : type === "end"
              ? "返回回答与产物"
              : "接收用户输入"
    }}</small>
    <template v-if="type === 'condition'"
      ><Handle
        id="true"
        type="source"
        :position="Position.Right"
        :style="{ top: '35%' }"
      /><span class="port-label yes">是</span
      ><Handle
        id="false"
        type="source"
        :position="Position.Right"
        :style="{ top: '75%' }"
      /><span class="port-label no">否</span></template
    >
    <Handle
      v-else-if="type !== 'end'"
      type="source"
      :position="Position.Right"
    />
  </div>
</template>
