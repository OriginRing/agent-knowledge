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
