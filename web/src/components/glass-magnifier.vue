<template>
  <a-button
    class="glass-toggle"
    type="text"
    shape="circle"
    :aria-label="enabled ? '关闭玻璃放大镜' : '开启玻璃放大镜'"
    :aria-pressed="enabled"
    @click="toggle"
  >
    <template #icon><SearchOutlined /></template>
  </a-button>

  <Teleport to="body">
    <canvas
      v-show="enabled"
      ref="lensCanvas"
      class="glass-magnifier"
      aria-hidden="true"
    />
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from "vue";
import { SearchOutlined } from "@ant-design/icons-vue";
import {
  createGlassRenderer,
  type GlassRenderer,
} from "@view/utils/glass-renderer";
import { captureGlassSnapshot } from "@view/utils/glass-snapshot";

const enabled = ref(false);
const lensCanvas = ref<HTMLCanvasElement>();

let captureRoot: HTMLElement | null = null;
let captureBounds: DOMRect | null = null;
let renderer: GlassRenderer | null = null;
let captureTimer = 0;
let captureToken = 0;
let capturing = false;
let captureQueued = false;
let lastPointer: PointerEvent | null = null;
let contentObserver: MutationObserver | null = null;

const placeOutput = () => {
  const canvas = lensCanvas.value;
  if (!canvas || !captureRoot) return null;
  const rect = captureRoot.getBoundingClientRect();
  captureBounds = rect;
  canvas.style.left = `${rect.left}px`;
  canvas.style.top = `${rect.top}px`;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  renderer?.resize();
  return rect;
};

const moveLens = (event: PointerEvent) => {
  lastPointer = event;
  const rect = captureBounds;
  if (!rect || !renderer) return;
  if (event.target instanceof Node && !captureRoot?.contains(event.target)) {
    renderer.hide();
    return;
  }
  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    renderer.hide();
    return;
  }
  renderer.move(event.clientX - rect.left, event.clientY - rect.top);
};

const captureWorkspace = async () => {
  if (!enabled.value) return;
  captureRoot = document.querySelector<HTMLElement>(".app-workspace");
  if (!captureRoot) return;
  const source = captureRoot;
  if (capturing) {
    captureQueued = true;
    return;
  }

  const token = ++captureToken;
  capturing = true;
  source.classList.add("glass-capture-source");
  try {
    const result = await captureGlassSnapshot(source);
    if (enabled.value && token === captureToken) {
      placeOutput();
      renderer?.updateTexture(result);
      if (lastPointer) moveLens(lastPointer);
    }
  } catch (error) {
    console.warn("无法获取玻璃放大镜所需的页面画面", error);
  } finally {
    source.classList.remove("glass-capture-source");
    capturing = false;
    if (captureQueued && enabled.value) {
      captureQueued = false;
      scheduleCapture(60);
    }
  }
};

const scheduleCapture = (delay = 120) => {
  window.clearTimeout(captureTimer);
  captureTimer = window.setTimeout(captureWorkspace, delay);
};

const handlePointerMove = (event: PointerEvent) => moveLens(event);
const handlePointerLeave = () => renderer?.hide();
const handlePointerDown = (event: PointerEvent) => {
  if (event.target instanceof Node && captureRoot?.contains(event.target)) {
    void captureWorkspace();
  }
};
const handlePointerUp = (event: PointerEvent) => {
  if (event.target instanceof Node && captureRoot?.contains(event.target)) {
    scheduleCapture(60);
  }
};
const handleContentMutations = (mutations: MutationRecord[]) => {
  const pointer = lastPointer;
  if (!pointer) return;
  const radius = 112;
  const affectsLens = mutations.some(({ target }) => {
    const element = target instanceof Element ? target : target.parentElement;
    if (!element || !captureRoot?.contains(element)) return false;
    const rect = element.getBoundingClientRect();
    return (
      rect.right >= pointer.clientX - radius &&
      rect.left <= pointer.clientX + radius &&
      rect.bottom >= pointer.clientY - radius &&
      rect.top <= pointer.clientY + radius
    );
  });
  if (!affectsLens) return;
  if (capturing) captureQueued = true;
  else scheduleCapture(140);
};
const invalidateCapture = () => {
  captureToken += 1;
  renderer?.invalidate();
  if (capturing) captureQueued = true;
};
const handleScroll = () => {
  invalidateCapture();
  scheduleCapture(60);
};
const handleResize = () => {
  invalidateCapture();
  placeOutput();
  scheduleCapture(100);
};
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Escape" && enabled.value) disable();
};

const enable = async () => {
  enabled.value = true;
  await nextTick();
  const canvas = lensCanvas.value;
  if (!canvas) return;
  renderer = createGlassRenderer(canvas);
  if (!renderer) {
    enabled.value = false;
    console.warn("当前浏览器不支持玻璃放大镜所需的 WebGL 2");
    return;
  }
  document.addEventListener("pointermove", handlePointerMove, {
    passive: true,
  });
  document.addEventListener("pointerdown", handlePointerDown, {
    passive: true,
  });
  document.addEventListener("pointerup", handlePointerUp, { passive: true });
  document.documentElement.addEventListener("pointerleave", handlePointerLeave);
  document.addEventListener("scroll", handleScroll, true);
  window.addEventListener("resize", handleResize);
  window.addEventListener("keydown", handleKeydown);
  await captureWorkspace();
  if (captureRoot) {
    contentObserver = new MutationObserver(handleContentMutations);
    contentObserver.observe(captureRoot, {
      characterData: true,
      childList: true,
      subtree: true,
    });
  }
};

const disable = () => {
  enabled.value = false;
  renderer?.destroy();
  renderer = null;
  captureRoot = null;
  captureBounds = null;
  lastPointer = null;
  captureToken += 1;
  captureQueued = false;
  contentObserver?.disconnect();
  contentObserver = null;
  window.clearTimeout(captureTimer);
  document.removeEventListener("pointermove", handlePointerMove);
  document.removeEventListener("pointerdown", handlePointerDown);
  document.removeEventListener("pointerup", handlePointerUp);
  document.documentElement.removeEventListener(
    "pointerleave",
    handlePointerLeave,
  );
  document.removeEventListener("scroll", handleScroll, true);
  window.removeEventListener("resize", handleResize);
  window.removeEventListener("keydown", handleKeydown);
};

const toggle = () => (enabled.value ? disable() : enable());

onBeforeUnmount(disable);
</script>

<style scoped lang="less">
.glass-toggle {
  width: 42px;
  height: 42px;
  color: var(--app-text-secondary);
  font-size: 18px;

  &:hover,
  &[aria-pressed="true"] {
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }

  &:focus-visible {
    box-shadow: var(--app-focus);
  }
}

.glass-magnifier {
  position: fixed;
  z-index: 2147483646;
  top: 0;
  left: 0;
  pointer-events: none;
}

:global(.glass-capture-source),
:global(.glass-capture-source *) {
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

:global(.glass-capture-source::-webkit-scrollbar),
:global(.glass-capture-source *::-webkit-scrollbar) {
  display: none !important;
  width: 0 !important;
  height: 0 !important;
}
</style>
