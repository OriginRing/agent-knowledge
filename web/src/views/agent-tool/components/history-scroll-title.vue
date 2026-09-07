<template>
  <span
    ref="viewportRef"
    class="history-scroll-title"
    :class="{ 'is-overflowing': isOverflowing }"
    :style="{
      '--history-scroll-distance': `${scrollDistance}px`,
      '--history-scroll-duration': `${scrollDuration}s`,
    }"
    :title="text"
  >
    <span ref="textRef" class="history-scroll-title__text">{{ text }}</span>
  </span>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  text: string;
}>();

const viewportRef = ref<HTMLElement>();
const textRef = ref<HTMLElement>();
const isOverflowing = ref(false);
const scrollDistance = ref(0);
const scrollDuration = ref(3);
let resizeObserver: ResizeObserver | undefined;
let measureFrame: number | undefined;
let emptyMeasureRetries = 0;
let isUnmounted = false;

const scheduleOverflowUpdate = () => {
  if (isUnmounted) return;
  if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
  measureFrame = requestAnimationFrame(updateOverflow);
};

const updateOverflow = () => {
  measureFrame = undefined;
  const viewport = viewportRef.value;
  const text = textRef.value;
  if (!viewport || !text) return;

  const viewportWidth = viewport.clientWidth;
  const textWidth = text.scrollWidth;
  if ((!viewportWidth || !textWidth) && emptyMeasureRetries < 6) {
    emptyMeasureRetries += 1;
    scheduleOverflowUpdate();
    return;
  }

  emptyMeasureRetries = 0;
  const distance = Math.max(0, textWidth - viewportWidth);
  isOverflowing.value = distance > 1;
  scrollDistance.value = distance;
  scrollDuration.value = Math.min(12, Math.max(3, distance / 36 + 1.5));
};

watch(
  () => props.text,
  async () => {
    await nextTick();
    emptyMeasureRetries = 0;
    scheduleOverflowUpdate();
  },
);

onMounted(() => {
  scheduleOverflowUpdate();
  if (typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(scheduleOverflowUpdate);
    if (viewportRef.value) resizeObserver.observe(viewportRef.value);
    if (textRef.value) resizeObserver.observe(textRef.value);
  }

  document.fonts?.ready.then(scheduleOverflowUpdate);
});

onBeforeUnmount(() => {
  isUnmounted = true;
  resizeObserver?.disconnect();
  if (measureFrame !== undefined) cancelAnimationFrame(measureFrame);
});
</script>

<style scoped lang="less">
.history-scroll-title {
  min-width: 0;
  display: block;
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
}

.history-scroll-title__text {
  width: max-content;
  max-width: 100%;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-scroll-title.is-overflowing:hover .history-scroll-title__text {
  max-width: none;
  overflow: visible;
  text-overflow: clip;
  will-change: transform;
  animation: history-title-scroll var(--history-scroll-duration) ease-in-out
    both;
}

@keyframes history-title-scroll {
  0%,
  12% {
    transform: translateX(0);
  }

  88%,
  100% {
    transform: translateX(calc(-1 * var(--history-scroll-distance)));
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-scroll-title.is-overflowing:hover .history-scroll-title__text {
    animation: none;
  }
}
</style>
