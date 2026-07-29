<script lang="ts" setup>
import { createFromIconfontCN } from "@ant-design/icons-vue";

const Iconfont = createFromIconfontCN({
  scriptUrl: "/iconfont.js",
});

defineProps<{
  type: string;
}>();
</script>
<template>
  <Iconfont :type="type" />
</template>
<style lang="less" scoped>
span {
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(span) {
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(svg) {
  width: 80%;
  height: 80%;
}
</style>
