// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentChat from "./index.vue";

vi.mock("ant-design-x-vue", () => ({
  BubbleList: {
    props: ["items"],
    template: `
      <div class="bubble-list-stub">
        <div v-for="item in items" :key="item.key">
          <slot name="message" :item="item" />
        </div>
      </div>
    `,
  },
  theme: { useToken: () => ({ token: { value: {} } }) },
}));
vi.mock("@ant-design/icons-vue", () => ({
  CopyOutlined: {},
  DownOutlined: {},
  DownloadOutlined: {},
  RollbackOutlined: {},
  SyncOutlined: {},
}));
vi.mock("@view/components/chat-input/index.vue", () => ({ default: {} }));
vi.mock("@view/components/chat-thought-chain.vue", () => ({ default: {} }));
vi.mock("@view/components/chat-message-anchors.vue", () => ({ default: {} }));
vi.mock("@view/components/file-icon.vue", () => ({ default: {} }));
vi.mock("@view/utils/typewriter", () => ({
  renderMarkdown: (content: string) => content,
  renderStreamingMarkdown: (content: string) => content,
}));

describe("AgentChat selection actions", () => {
  let nextFrameId: number;
  let frameCallbacks: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    setActivePinia(createPinia());
    nextFrameId = 0;
    frameCallbacks = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrameId += 1;
      frameCallbacks.set(nextFrameId, callback);
      return nextFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      frameCallbacks.delete(frameId);
    });
  });

  afterEach(() => {
    window.getSelection()?.removeAllRanges();
    vi.unstubAllGlobals();
  });

  const runAllFrames = () => {
    while (frameCallbacks.size) {
      const frames = [...frameCallbacks.values()];
      frameCallbacks.clear();
      frames.forEach((callback) => callback(0));
    }
  };

  it("滚动时取消文字引用操作", async () => {
    const wrapper = mount(AgentChat, {
      global: {
        stubs: {
          ChatInput: true,
          ChatMessageAnchors: true,
        },
      },
    });
    const content = wrapper.get(".chat-content").element;
    const range = document.createRange();
    range.selectNodeContents(content);
    Object.defineProperty(range, "getBoundingClientRect", {
      value: () => ({
        bottom: 260,
        height: 20,
        left: 100,
        right: 180,
        top: 240,
        width: 80,
        x: 100,
        y: 240,
        toJSON: () => ({}),
      }),
    });
    window.getSelection()?.addRange(range);

    await wrapper.get(".bubble-list-stub").trigger("mouseup");
    runAllFrames();
    await nextTick();
    expect(wrapper.get(".selection-actions").attributes("style")).toContain(
      "top: 228px",
    );

    await wrapper.get(".bubble-list-stub").trigger("scroll");
    runAllFrames();
    await nextTick();
    expect(wrapper.find(".selection-actions").exists()).toBe(false);
    expect(window.getSelection()?.rangeCount).toBe(0);
  });
});
