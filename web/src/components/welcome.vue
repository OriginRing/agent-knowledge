<template>
  <Welcome title="Hello, I'm Ollama" description="有什么可以帮到你的吗~">
    <template #icon>
      <CommentOutlined style="font-size: 60px" />
    </template>
  </Welcome>
</template>
<script setup lang="tsx">
import { Welcome } from 'ant-design-x-vue'
import { CommentOutlined } from '@ant-design/icons-vue'
</script>
<style lang="less" scoped>
.ant-welcome {
  width: 75%;
}
</style>
