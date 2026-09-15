<template>
  <a-modal
    :open="Boolean(background)"
    width="520px"
    title="新背景推荐"
    :footer="null"
    centered
    @cancel="dismiss"
  >
    <div v-if="background" class="background-push-content">
      <button
        class="background-push-preview"
        type="button"
        :aria-label="`使用推荐背景 ${background.name}`"
        @click="applyBackground"
      >
        <img :src="background.url" :alt="`${background.name} 背景预览`" />
      </button>
      <div class="background-push-copy">
        <h3>{{ background.name }}</h3>
        <p>
          {{
            background.promotionText ||
            "发现一张新的页面背景，点击图片即可立即使用。"
          }}
        </p>
      </div>
      <a-flex justify="flex-end" gap="8">
        <a-button @click="dismiss">稍后再说</a-button>
        <a-button type="primary" @click="applyBackground">立即使用</a-button>
      </a-flex>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useThemeStore } from "@view/stores/theme";

const themeStore = useThemeStore();
const background = computed(() => themeStore.pushedBackground);

const dismiss = () => {
  themeStore.dismissPushedBackground();
};

const applyBackground = () => {
  if (!background.value) return;
  themeStore.setBackgroundImage(background.value.id);
  dismiss();
};
</script>

<style scoped lang="less">
.background-push-content {
  display: grid;
  gap: 18px;
}

.background-push-preview {
  width: 100%;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 16px;
  background: var(--app-surface-soft);
  cursor: pointer;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:hover,
  &:focus-visible {
    border-color: var(--app-primary);
    box-shadow: var(--app-focus);
    outline: none;
    transform: translateY(-2px);
  }

  img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }
}

.background-push-copy {
  display: grid;
  gap: 6px;

  h3,
  p {
    margin: 0;
  }

  h3 {
    color: var(--app-text);
    font-size: 18px;
  }

  p {
    color: var(--app-text-secondary);
    line-height: 1.65;
  }
}

@media (prefers-reduced-motion: reduce) {
  .background-push-preview {
    transition-duration: 0.01ms !important;
  }
}
</style>
