<template>
  <div
    ref="gSplitRef"
    :style="{
      '--color-bg-layout': token.colorBorderSecondary,
    }"
    class="g-split"
  >
    <!-- 水平方向 -->
    <div v-if="showHorizontal" class="horizontal">
      <div
        v-show="disable !== 'left'"
        class="left-panel position"
        :style="horizontalLeftPanel"
      >
        <slot name="left"></slot>
      </div>
      <div
        v-show="disable !== 'left' && disable !== 'right'"
        ref="horizontalTriggerPanelRef"
        class="horizontal-trigger-panel position"
        :style="horizontaltriggerPanel"
      >
        <!-- 触发拖动的元素可以是默认的，当用户提供了，使用用户的 -->
        <slot v-if="$slots.trigger" name="trigger"></slot>
        <div v-else class="trigger-content-default-wrap">
          <div class="trigger-content">
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
          </div>
        </div>
      </div>
      <div
        v-show="disable !== 'right'"
        class="right-panel position"
        :style="horizontalRightPanel"
      >
        <slot name="right"></slot>
      </div>
    </div>
    <!-- 垂直方向 -->
    <div v-if="showVertical" class="vertical">
      <div
        v-show="disable !== 'top'"
        class="top-panel position"
        :style="verticalTopPanel"
      >
        <slot name="top"></slot>
      </div>
      <div
        v-show="disable !== 'top' && disable !== 'bottom'"
        ref="verticalTriggerPanelRef"
        class="vertical-trigger-panel position"
        :style="verticaltriggerPanel"
      >
        <!-- 触发拖动的元素可以是默认的，当用户提供了，使用用户的 -->
        <slot v-if="$slots.trigger" name="trigger"></slot>
        <div v-else class="trigger-content-default-wrap">
          <div class="trigger-content">
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
            <i class="trigger-bar"></i>
          </div>
        </div>
      </div>
      <div
        v-show="disable !== 'bottom'"
        class="bottom-panel position"
        :style="verticalBottomPanel"
      >
        <slot name="bottom"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { theme } from "ant-design-vue";

// 注意：页面偏移量单位统一使用百分比计算

interface Props {
  // v-model绑定的值，初始的偏移量
  value?: string | number;
  // 上下面板还是左右面板，默认为上下格式
  mode?: "horizontal" | "vertical";
  // 拖拽占盒子最小比例
  min?: string | number;
  // 拖拽占盒子最大比例
  max?: string | number;
  // 隐藏一侧
  disable?: "left" | "right" | "bottom" | "top" | null;
}

const { useToken } = theme;
const { token } = useToken();

const props = withDefaults(defineProps<Props>(), {
  value: 0.5,
  mode: "horizontal",
  min: 0.1,
  max: 0.9,
  disable: null,
});

const emit = defineEmits<{
  "on-move-start": [e: MouseEvent];
  "on-moving": [e: MouseEvent];
  "on-move-end": [e: MouseEvent];
}>();

// refs
const gSplitRef = ref<HTMLElement | null>(null);
const horizontalTriggerPanelRef = ref<HTMLElement | null>(null);
const verticalTriggerPanelRef = ref<HTMLElement | null>(null);

// 响应式数据
const left = ref(Number(props.value));
const top = ref(Number(props.value));
const gSplitWidth = ref(0);
const gSplitHeight = ref(0);
const horizontalTriggerPanelWidth = ref(0);
const verticalTriggerPanelHeight = ref(0);

// 是否显示左右拖动面板
const showHorizontal = computed(() => props.mode === "horizontal");
// 是否显示上下拖动面板
const showVertical = computed(() => props.mode === "vertical");

// 左侧面板偏移量
const horizontalLeftPanel = computed(() => ({
  left: 0,
  right: props.disable === "right" ? "0%" : (1 - left.value) * 100 + "%",
}));

// 右侧面板偏移量
const horizontalRightPanel = computed(() => ({
  // 注意：要加上中间的trigger内容区的宽度
  left:
    props.disable === "left"
      ? "0%"
      : (left.value + horizontalTriggerPanelWidth.value / gSplitWidth.value) *
          100 +
        "%",
}));

// 左右面板中间trigger拖拽部分的偏移量
const horizontaltriggerPanel = computed(() => ({
  left: left.value * 100 + "%",
}));

// 上面面板偏移量
const verticalTopPanel = computed(() => ({
  top: 0,
  bottom: props.disable === "bottom" ? "0%" : (1 - top.value) * 100 + "%",
}));

// 下面面板偏移量
const verticalBottomPanel = computed(() => ({
  top:
    props.disable === "top"
      ? "0%"
      : (top.value + verticalTriggerPanelHeight.value / gSplitHeight.value) *
          100 +
        "%",
}));

// 上下面板中间trigger拖拽部分偏移量
const verticaltriggerPanel = computed(() => ({
  top: top.value * 100 + "%",
}));

// 禁用页面文字选中函数
const preventSelectedOnMouseMove = (e: Event) => {
  e.preventDefault();
};

// 处理拖拽逻辑，水平和垂直的逻辑合在一起
const resolveMouseFn = (
  type: "horizontal" | "vertical",
  element: HTMLElement,
) => {
  const mousedown = (e: MouseEvent) => {
    // 禁止页面文字的选中，避免在拖拽过程出现文字被选中的行为
    document.addEventListener("selectstart", preventSelectedOnMouseMove);
    // 发布开始拖拽事件
    emit("on-move-start", e);
    // 获取鼠标点击的位置距离元素边缘的距离
    const pos = type === "horizontal" ? "left" : "top";
    const distance =
      type === "horizontal"
        ? e.clientX - element.offsetLeft
        : e.clientY - element.offsetTop;
    const mousemove = (e: MouseEvent) => {
      // 发布拖拽中事件
      emit("on-moving", e);
      const gSplitSize =
        type === "horizontal"
          ? gSplitRef.value!.clientWidth
          : gSplitRef.value!.clientHeight;
      const ratio =
        (type === "horizontal" ? e.clientX - distance : e.clientY - distance) /
        gSplitSize;
      // 控制范围
      const min = Number(props.min);
      const setter = (v: number) =>
        pos === "left" ? (left.value = v) : (top.value = v);
      if (ratio < min) {
        setter(min);
      } else if (ratio > 1 - min) {
        setter(1 - min);
      } else {
        setter(ratio);
      }
      return false;
    };
    const mouseup = (e: MouseEvent) => {
      // 发布拖拽结束事件
      emit("on-move-end", e);
      // 释放按下和滑动处理函数以及禁用选中的处理函数
      document.removeEventListener("mousemove", mousemove);
      document.removeEventListener("mouseup", mouseup);
      document.removeEventListener("selectstart", preventSelectedOnMouseMove);
      return false;
    };
    document.addEventListener("mousemove", mousemove);
    document.addEventListener("mouseup", mouseup);
    return false;
  };
  element.addEventListener("mousedown", mousedown);
};

// 初始化部分dom元素的尺寸
const initDom = () => {
  if (!gSplitRef.value) return;
  gSplitWidth.value = gSplitRef.value.clientWidth;
  gSplitHeight.value = gSplitRef.value.clientHeight;
  if (props.mode === "horizontal" && horizontalTriggerPanelRef.value) {
    horizontalTriggerPanelWidth.value =
      horizontalTriggerPanelRef.value.clientWidth;
  }
  if (props.mode === "vertical" && verticalTriggerPanelRef.value) {
    verticalTriggerPanelHeight.value =
      verticalTriggerPanelRef.value.clientHeight;
  }
};

const bindEvent = async () => {
  await nextTick();
  // 根据mode来决定绑定哪种类型的事件
  if (props.mode === "horizontal" && horizontalTriggerPanelRef.value) {
    resolveMouseFn("horizontal", horizontalTriggerPanelRef.value);
  }
  if (props.mode === "vertical" && verticalTriggerPanelRef.value) {
    resolveMouseFn("vertical", verticalTriggerPanelRef.value);
  }
};

watch(
  () => props.disable,
  () => {
    bindEvent();
  },
  { flush: "post" }, // DOM更新后执行，等价nextTick
);

onMounted(() => {
  bindEvent();
  initDom();
});
</script>

<style scoped lang="less">
.g-split {
  height: 100%;
  overflow: hidden;
  .position {
    position: absolute;
  }
  .horizontal {
    position: relative;
    height: 100%;
    .left-panel {
      height: 100%;
    }
    .right-panel {
      height: 100%;
      right: 0;
    }
    .horizontal-trigger-panel {
      cursor: col-resize;
      height: 100%;
      z-index: 999;
      .trigger-content-default-wrap {
        background-color: var(--color-bg-layout);
        height: 100%;
        position: relative;
        width: 4px;
        .trigger-content {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          .trigger-bar {
            width: 4px;
            height: 1px;
            display: block;
            background: rgba(23, 35, 61, 0.25);
            margin-top: 3px;
          }
        }
      }
    }
  }
  .vertical {
    position: relative;
    height: 100%;
    .top-panel {
      width: 100%;
    }
    .bottom-panel {
      width: 100%;
    }
    .vertical-trigger-panel {
      width: 100%;
      .trigger-content-default-wrap {
        width: 100%;
        position: relative;
        height: 4px;
        cursor: row-resize;
        background-color: var(--color-bg-layout);
        .trigger-content {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
          height: 100%;
          .trigger-bar {
            width: 1px;
            height: 100%;
            display: inline-block;
            background: rgba(23, 35, 61, 0.25);
            margin-left: 3px;
            vertical-align: top;
          }
        }
      }
    }
  }
}
</style>
