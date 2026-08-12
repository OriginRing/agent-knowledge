<template>
  <a-modal
    v-model:open="open"
    width="680px"
    title="选择页面背景"
    :footer="null"
    destroy-on-close
  >
    <p class="background-picker-help">
      选择后立即应用。页面面板会呈半透明效果，文字仍保持清晰不透明。
    </p>
    Ï
    <div class="background-grid" aria-label="可用背景图片">
      <button
        v-for="image in backgroundImages"
        :key="image.id"
        class="background-option"
        :class="{ selected: themeService.backgroundImageId === image.id }"
        type="button"
        :aria-label="`使用背景 ${image.name}`"
        :aria-pressed="themeService.backgroundImageId === image.id"
        @click="selectBackground(image.id)"
      >
        <img :src="image.url" :alt="`${image.name} 背景预览`" loading="lazy" />
        <span class="background-option-label">
          <span>{{ image.name }}</span>
          <CheckCircleFilled
            v-if="themeService.backgroundImageId === image.id"
            aria-hidden="true"
          />
        </span>
      </button>
    </div>
    <a-empty
      v-if="backgroundImages.length === 0"
      description="assets/bg-images 中暂无可用图片"
    />
    <a-flex class="background-picker-actions" justify="space-between" gap="8">
      <a-button
        :disabled="!themeService.backgroundImageId"
        @click="selectBackground('')"
      >
        恢复默认背景
      </a-button>
      <a-button type="primary" @click="open = false">完成</a-button>
    </a-flex>
  </a-modal>
</template>

<script setup lang="ts">
import { CheckCircleFilled } from "@ant-design/icons-vue";
import { backgroundImages, useThemeStore } from "@view/stores/theme";

const open = defineModel<boolean>("open", { required: true });
const themeService = useThemeStore();

const selectBackground = (imageId: string) => {
  themeService.setBackgroundImage(imageId);
};
</script>

<style scoped lang="less">
.background-picker-help {
  margin-bottom: 18px;
  color: var(--app-text-secondary);
}

.background-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  max-height: min(52vh, 440px);
  padding: 3px;
  overflow-y: auto;
}

.background-option {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 16px;
  color: var(--app-text);
  background: var(--app-surface-soft);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: var(--app-accent-border, var(--app-border));
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--app-primary);
    box-shadow: var(--app-focus);
  }

  img {
    display: block;
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
  }
}

.background-option-label {
  display: flex;
  min-height: 44px;
  padding: 8px 12px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 650;

  .anticon {
    flex: none;
    color: var(--app-primary);
  }
}

.background-picker-actions {
  margin-top: 20px;
}

@media (max-width: 560px) {
  .background-grid {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .background-option {
    transition-duration: 0.01ms !important;
  }
}
</style>
