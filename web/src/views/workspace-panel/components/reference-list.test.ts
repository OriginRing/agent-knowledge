// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file */

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { defineComponent, h } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KnowledgeDoc } from "@view/interfaces/agent-interface";
import { useChatStore } from "@view/stores/chat";
import ReferenceList from "./reference-list.vue";

const mocks = vi.hoisted(() => ({
  hide: vi.fn(),
  error: vi.fn(),
}));

vi.mock("ant-design-vue", () => ({
  message: {
    loading: () => mocks.hide,
    error: mocks.error,
  },
}));

const CardStub = defineComponent({
  name: "ACard",
  setup(_, { slots }) {
    return () =>
      h("article", { class: "reference-card" }, [
        h("header", slots.title?.()),
        h("div", slots.extra?.()),
        slots.default?.(),
      ]);
  },
});

const ButtonStub = defineComponent({
  name: "AButton",
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", attrs, slots.default?.());
  },
});

const createDoc = (content: string): KnowledgeDoc => ({
  fileId: "doc-1",
  fileName: "产品手册.pdf",
  fileUrl: "/files/product.pdf",
  fileContent: content,
  createdAt: 1,
});

describe("参考资料列表", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  afterEach(() => vi.unstubAllGlobals());

  const mountList = () =>
    mount(ReferenceList, {
      global: {
        stubs: {
          AButton: ButtonStub,
          ACard: CardStub,
          ADivider: true,
          AEmpty: true,
        },
      },
    });

  it("按文件去重并合并同一资料的知识片段", () => {
    useChatStore().setAgentPreviewFiles([
      createDoc("第一段"),
      createDoc("第二段"),
    ]);

    const wrapper = mountList();

    expect(wrapper.findAll(".reference-card")).toHaveLength(1);
    expect(wrapper.text()).toContain("第一段");
    expect(wrapper.text()).toContain("第二段");
    expect(wrapper.get("button").text()).toBe("查看原文");
  });

  it("查看原文时在工作面板内打开引用文件", async () => {
    const chat = useChatStore();
    chat.setAgentPreviewFiles([createDoc("命中片段")]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("原文内容", {
          headers: { "Content-Type": "application/pdf" },
        }),
      ),
    );
    const wrapper = mountList();

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(fetch).toHaveBeenCalledWith(
      "/files/product.pdf",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(chat.panelMode).toBe("file");
    expect(chat.previewFileSource).toBe("references");
    expect(chat.agentPreviewFile?.name).toBe("产品手册.pdf");
  });
});
