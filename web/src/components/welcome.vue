<template>
  <Welcome
    class="welcome-card"
    title="Hello, I'm Ollama"
    description="有什么可以帮到你的吗~"
  >
    <template #icon>
      <CommentOutlined style="font-size: 60px" />
    </template>
  </Welcome>
</template>
<script setup lang="tsx">
import { Welcome } from "ant-design-x-vue";
import { CommentOutlined } from "@ant-design/icons-vue";
</script>
<style lang="less" scoped>
.welcome-card {
  position: relative;
  width: min(75%, 680px);
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: 26px;
  background:
    radial-gradient(
      circle at 88% 20%,
      rgba(57, 169, 134, 0.16),
      transparent 25%
    ),
    linear-gradient(135deg, var(--app-primary-soft), var(--app-surface-solid));
  box-shadow: var(--app-shadow-soft);

  &::after {
    position: absolute;
    right: 34px;
    bottom: -18px;
    width: 72px;
    height: 72px;
    border: 16px solid rgba(113, 103, 232, 0.08);
    border-radius: 50%;
    content: "";
    pointer-events: none;
  }

  :deep(.ant-welcome-icon) {
    width: 84px;
    height: 84px;
    display: grid;
    place-items: center;
    border-radius: 28px 28px 28px 10px;
    color: #fff;
    background: linear-gradient(145deg, var(--app-primary), #9389f6);
    box-shadow: 0 5px 14px rgba(113, 103, 232, 0.2);
  }

  :deep(.ant-welcome-title) {
    color: var(--app-text);
    font-weight: 780;
    letter-spacing: -0.03em;
  }

  :deep(.ant-welcome-description) {
    color: var(--app-text-secondary);
  }
}

@media (max-width: 768px) {
  .welcome-card {
    width: 100%;
    border-radius: 20px;
  }
}
</style>
