<template>
  <Iconfont v-if="isImageFile(name)" type="icon-sunyardtupian"></Iconfont>
  <Iconfont v-else type="icon-sunyardweibiaoti--"></Iconfont>
</template>
<script setup lang="ts">
import Iconfont from "@view/components/iconfont.vue";
import { isImageFile } from "@view/utils/file";

defineProps<{ name: string }>();
</script>
