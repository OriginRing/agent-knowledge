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
:deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
