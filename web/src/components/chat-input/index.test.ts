// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file */

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, type Component } from "vue";

import ChatInput from "./index.vue";
import type { AgentDetail } from "@view/interfaces/agent-interface";
import { useChatStore } from "@view/stores/chat";

vi.mock("@ant-design/icons-vue", () => {
  const icon = (name: string) =>
    defineComponent({
      name,
      setup: () => () => h("span", { class: `icon-${name}` }),
    });
  return {
    ApiOutlined: icon("api"),
    CloseCircleOutlined: icon("close-circle"),
    CloseOutlined: icon("close"),
    ExclamationOutlined: icon("exclamation"),
    GlobalOutlined: icon("global"),
    PaperClipOutlined: icon("paper-clip"),
  };
});

vi.mock("ant-design-vue", () => ({
  message: { error: vi.fn(), warning: vi.fn() },
  theme: {
    useToken: () => ({
      token: {
        value: {
          colorTextTertiary: "#999",
          colorFillQuaternary: "#fff",
          colorBgElevated: "#fff",
        },
      },
    }),
  },
}));

vi.mock("ant-design-x-vue", () => ({
  Sender: defineComponent({
    name: "Sender",
    inheritAttrs: false,
    props: {
      value: { type: String, default: "" },
      placeholder: { type: String, default: "" },
      components: { type: Object, default: () => ({}) },
    },
    emits: ["update:value"],
    setup(props, { attrs, emit, slots }) {
      const ActionButton = defineComponent({
        setup: () => () => h("button"),
      });
      return () =>
        h("div", { class: "sender" }, [
          slots.header?.(),
          h("div", { class: "sender-content" }, [
            h(
              ((props.components as { input?: Component }).input ||
                "textarea") as Component,
              {
                value: props.value,
                placeholder: props.placeholder,
                onChange: (event: { target: { value: string } }) =>
                  emit("update:value", event.target.value),
                onKeydown: attrs.onKeydown,
              },
            ),
          ]),
          slots.footer?.({
            info: {
              components: {
                SendButton: ActionButton,
                LoadingButton: ActionButton,
              },
            },
          }),
        ]);
    },
  }),
}));

vi.mock("@view/components/file-icon.vue", () => ({
  default: defineComponent({ setup: () => () => h("span") }),
}));

const agents: AgentDetail[] = [
  {
    agentCode: "writer",
    agentName: "写作助手",
    description: "帮助撰写内容",
    id: 1,
    model_type: "test",
    status: 1,
    default: true,
    supportConnect: false,
    supportDownload: false,
    supportFile: false,
    supportKnowledge: false,
    supportThink: false,
  },
  {
    agentCode: "analyst",
    agentName: "数据分析师",
    description: "分析数据",
    id: 2,
    model_type: "test",
    status: 1,
    default: false,
    supportConnect: false,
    supportDownload: false,
    supportFile: false,
    supportKnowledge: false,
    supportThink: false,
  },
];

describe("chat input agent mention", () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    const store = useChatStore(pinia);
    store.setAgentList(agents);
    store.setAgentDetail(agents[0]);
  });

  const mentionDefaultAgent = async (wrapper: ReturnType<typeof mount>) => {
    const editor = wrapper.get(".agent-mention-editor");
    editor.element.textContent = "@";
    await editor.trigger("input");
    await editor.trigger("keydown", { key: "Enter" });
    return editor;
  };

  it("uses the default agent without rendering a mention", () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");

    expect(useChatStore(pinia).getAgentDetail.agentCode).toBe("writer");
    expect(editor.find(".selected-agent").exists()).toBe(false);
    expect(editor.attributes("data-placeholder")).toBe("请输入...");
  });

  it("opens on @ and selects an agent with the keyboard", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const input = wrapper.get(".agent-mention-editor");
    expect(
      wrapper.get(".agent-mention-editor").attributes("contenteditable"),
    ).toBe("true");
    expect(
      wrapper.get(".agent-mention-editor").attributes("aria-multiline"),
    ).toBe("true");

    input.element.textContent = "请让 @";
    await input.trigger("input");
    expect(wrapper.findAll(".agent-mention-option")).toHaveLength(2);

    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "Enter" });

    expect(useChatStore(pinia).getAgentDetail.agentCode).toBe("analyst");
    const editor = wrapper.get(".agent-mention-editor");
    expect(editor.get(".selected-agent").text()).toContain("@数据分析师");
    expect(editor.attributes("contenteditable")).toBe("true");
    expect(editor.element.firstChild?.textContent).toBe("请让 ");
    expect(editor.element.lastChild?.textContent).toBe("\u2060");
  });

  it("keeps the mention protected and clears only from its close control", async () => {
    const store = useChatStore(pinia);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = await mentionDefaultAgent(wrapper);
    expect(editor.classes()).toContain("empty");
    expect(editor.attributes("data-placeholder")).toBe("请输入...");

    await wrapper.get(".selected-agent").trigger("mousedown");
    expect(store.getAgentDetail.agentCode).toBe("writer");

    await wrapper.get(".selected-agent-close").trigger("mousedown");

    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(wrapper.find(".selected-agent").exists()).toBe(false);
    expect(editor.attributes("data-placeholder")).toBe("请输入...");
    expect(editor.element.textContent).toBe("");
  });

  it("copies normal text while excluding the agent mention", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editorWrapper = await mentionDefaultAgent(wrapper);
    const editor = editorWrapper.element;
    editor.append(document.createTextNode("需要复制的文案"));

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    selection?.removeAllRanges();
    selection?.addRange(range);

    const setData = vi.fn();
    const copyEvent = new Event("copy", {
      bubbles: true,
      cancelable: true,
    }) as ClipboardEvent;
    Object.defineProperty(copyEvent, "clipboardData", {
      value: { setData },
    });
    editor.dispatchEvent(copyEvent);

    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      expect.stringContaining("需要复制的文案"),
    );
    expect(setData.mock.calls[0][1]).not.toContain("@写作助手");
  });

  it("restores the agent selection placeholder after keyboard deletion", async () => {
    const store = useChatStore(pinia);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = await mentionDefaultAgent(wrapper);

    editor.element.querySelector(".selected-agent")?.remove();
    await editor.trigger("input");

    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(editor.attributes("data-placeholder")).toBe("请输入...");
    expect(editor.element.textContent).toBe("");
  });
});
