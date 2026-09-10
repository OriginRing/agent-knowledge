// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AgentChat from "./index.vue";
import { useChatStore } from "@view/stores/chat";

const fileMocks = vi.hoisted(() => ({
  prepareDocxContent: vi.fn(),
  saveDocx: vi.fn(),
}));

vi.mock("ant-design-x-vue", () => ({
  BubbleList: {
    props: ["items"],
    methods: { scrollTo() {} },
    template: `
      <div class="bubble-list-stub">
        <div
          v-for="item in items"
          :key="item.key"
          :class="item.rootClassName"
        >
          <slot name="header" :item="item" />
          <div class="ant-bubble-content">
            <slot name="message" :item="item" />
          </div>
          <slot name="footer" :item="item" />
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
  FormOutlined: {},
  RollbackOutlined: {},
  SyncOutlined: {},
}));
vi.mock("@view/components/chat-input/index.vue", () => ({ default: {} }));
vi.mock("@view/components/chat-thought-chain.vue", () => ({ default: {} }));
vi.mock("@view/components/chat-message-anchors.vue", () => ({ default: {} }));
vi.mock("@view/components/file-icon.vue", () => ({
  default: { template: '<span class="file-icon-stub" />' },
}));
vi.mock("@view/utils/typewriter", () => ({
  renderMarkdown: (content: string) => content,
  renderStreamingMarkdown: (content: string) => content,
}));
vi.mock("@view/utils/save-file", () => fileMocks);

describe("AgentChat selection actions", () => {
  let nextFrameId: number;
  let frameCallbacks: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    document.body.innerHTML = "";
    setActivePinia(createPinia());
    fileMocks.prepareDocxContent.mockResolvedValue({
      html: '<h2>可编辑回答</h2><img src="data:image/png;base64,chart" alt="GPT-Vis 图表">',
      failedChartCount: 0,
    });
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

  it("仅发送文件时只展示文件卡片", async () => {
    const wrapper = mount(AgentChat, {
      global: {
        stubs: {
          ChatInput: true,
          ChatMessageAnchors: true,
        },
      },
    });
    useChatStore().setAgentHistoryDetail([
      {
        key: "file-only-user",
        role: "user",
        content: "",
        files: "https://oss.example.com/report.pdf",
      },
    ]);

    await nextTick();

    expect(wrapper.find(".file-icon-stub").exists()).toBe(true);
    expect(wrapper.find(".user-message").exists()).toBe(false);
    expect(wrapper.find(".file-only-user-message").exists()).toBe(true);
    expect(wrapper.find('[aria-label="复制消息"]').exists()).toBe(false);
  });

  it("点击已完成回答后将渲染 DOM 转为含图 HTML 再打开编辑器", async () => {
    const wrapper = mount(AgentChat, {
      attachTo: document.body,
      global: {
        stubs: {
          ChatInput: true,
          ChatMessageAnchors: true,
        },
      },
    });
    useChatStore().setAgentHistoryDetail([
      {
        key: "assistant-1",
        role: "assistant",
        content: "## 可编辑回答",
        complete: true,
      },
    ]);
    await nextTick();

    await wrapper.get('[aria-label="编辑回答"]').trigger("click");

    expect(fileMocks.prepareDocxContent).toHaveBeenCalledWith(
      wrapper.get(".assistant-message").element,
    );

    expect(useChatStore().panelMode).toBe("answer");
    expect(useChatStore().answerDraft).toEqual({
      id: "assistant-1",
      content:
        '<h2>可编辑回答</h2><img src="data:image/png;base64,chart" alt="GPT-Vis 图表">',
    });
    wrapper.unmount();
  });
});
