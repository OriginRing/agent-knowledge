// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@view/stores/chat";
import AnswerEditorPanel from "./answer-editor-panel.vue";

const mocks = vi.hoisted(() => ({
  saveHtmlAsDocx: vi.fn(),
}));

const RichTextEditorStub = defineComponent({
  name: "RichTextEditor",
  props: {
    initialContent: { type: String, default: "" },
    initialFormat: { type: String, default: "html" },
  },
  template: '<div class="rich-text-editor-stub" />',
});

vi.mock("@view/utils/save-file", () => ({
  saveHtmlAsDocx: mocks.saveHtmlAsDocx,
}));

type AnswerPanelVm = {
  answerHtml: string;
  downloadAnswer: () => Promise<void>;
};

const mountPanel = () => {
  const pinia = createPinia();
  const chat = useChatStore(pinia);
  chat.openAnswerEditor({
    id: "answer-1",
    content:
      '<h2>原回答</h2><img src="data:image/png;base64,chart" alt="GPT-Vis 图表">',
  });
  const wrapper = mount(AnswerEditorPanel, {
    global: {
      plugins: [pinia],
      stubs: {
        "a-button": true,
        RichTextEditor: RichTextEditorStub,
      },
    },
  });
  return { chat, wrapper };
};

describe("右侧回答编辑面板", () => {
  beforeEach(() => vi.clearAllMocks());

  it("向公共编辑器传入包含图表图片的回答 HTML", () => {
    const { wrapper } = mountPanel();
    const editor = wrapper.getComponent({ name: "RichTextEditor" });

    expect(editor.props("initialContent")).toContain("<h2>原回答</h2>");
    expect(editor.props("initialContent")).toContain(
      "data:image/png;base64,chart",
    );
    expect(editor.props("initialFormat")).toBe("html");
  });

  it("下载编辑后的 HTML 为 DOCX", async () => {
    const { wrapper } = mountPanel();
    const vm = wrapper.vm as unknown as AnswerPanelVm;
    vm.answerHtml = "<h2>修改后的回答</h2>";

    await vm.downloadAnswer();

    expect(mocks.saveHtmlAsDocx).toHaveBeenCalledWith(
      "<h2>修改后的回答</h2>",
      "智能体回答-answer-1.docx",
    );
  });
});
