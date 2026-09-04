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

  it("fills slot templates, hides template delimiters and sends edited plain text", async () => {
    const store = useChatStore(pinia);
    store.setAgentDetail({
      ...agents[0]!,
      slot: [
        {
          title: "查询指定人员今年的销售额",
          content:
            "查询<<xxx>>今年的销售额，按{{月份}}展示\n<script>alert(1)</script>",
        },
      ],
    });
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    await wrapper.get(".agent-slot-button").trigger("click");
    const editor = wrapper.get(".agent-mention-editor");
    expect(wrapper.get(".agent-slot-button").text()).toBe(
      "查询指定人员今年的销售额",
    );
    expect(
      editor.findAll(".slot-placeholder").map((item) => item.text()),
    ).toEqual(["xxx", "月份"]);
    expect(editor.get(".slot-angle").text()).toBe("xxx");
    expect(editor.get(".slot-brace").text()).toBe("月份");
    expect(editor.find("script").exists()).toBe(false);
    expect(wrapper.emitted("sendMessage")).toBeUndefined();
    editor.get(".slot-placeholder").element.textContent = "张三";
    await editor.trigger("input");
    await editor.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("sendMessage")?.[0]?.[0]).toBe(
      "查询张三今年的销售额，按月份展示\n<script>alert(1)</script>",
    );
    expect(editor.findAll(".slot-placeholder")).toHaveLength(0);
    store.setAgentDetail(agents[1]!);
    await wrapper.vm.$nextTick();
    expect(wrapper.find(".agent-slot-button").exists()).toBe(false);
  });

  it("keeps manually entered delimiters literal and unstyled", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");
    editor.element.textContent = "输入<<xxx>>和{{xxx}}";
    await editor.trigger("input");
    expect(editor.findAll(".slot-placeholder")).toHaveLength(0);
    await editor.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("sendMessage")?.[0]?.[0]).toBe(
      "输入<<xxx>>和{{xxx}}",
    );
  });

  it("uses the default agent without a mention on initialization", () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");

    expect(useChatStore(pinia).getAgentDetail.agentCode).toBe("writer");
    expect(editor.find(".selected-agent").exists()).toBe(false);
    expect(editor.attributes("data-placeholder")).toBe("请输入...");
  });

  it("inserts a line break with Shift+Enter and sends multiline text with Enter", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");
    const lineBreakEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    editor.element.dispatchEvent(lineBreakEvent);

    expect(lineBreakEvent.defaultPrevented).toBe(false);
    expect(wrapper.emitted("sendMessage")).toBeUndefined();

    editor.element.textContent = "第一行\n第二行";
    await editor.trigger("input");
    await editor.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("sendMessage")?.[0]?.[0]).toBe("第一行\n第二行");
  });

  it("combines the quoted content and typed question when sending", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    (wrapper.vm as unknown as { setQuote: (content: string) => void }).setQuote(
      "可以用这种写法",
    );
    const editor = wrapper.get(".agent-mention-editor");
    editor.element.textContent = "这是什么意思？";
    await editor.trigger("input");
    await editor.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("sendMessage")?.[0]?.[0]).toBe(
      "可以用这种写法\n\n这是什么意思？",
    );
    expect(wrapper.find(".input-quote").exists()).toBe(false);
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

  it("returns to the default agent without a mention after closing", async () => {
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
    expect(editor.find(".selected-agent").exists()).toBe(false);
  });

  it("switches twice through @ and returns to default after deleting the mention", async () => {
    const store = useChatStore(pinia);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");
    editor.element.append(document.createTextNode("@"));
    await editor.trigger("input");
    await wrapper.get("#agent-option-analyst").trigger("mousedown");
    expect(store.getAgentDetail.agentCode).toBe("analyst");
    expect(wrapper.get(".selected-agent").text()).toContain("@数据分析师");
    editor.element.append(document.createTextNode(" @"));
    await editor.trigger("input");
    await wrapper.get("#agent-option-writer").trigger("mousedown");
    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(wrapper.get(".selected-agent").text()).toContain("@写作助手");
    editor.element.append(document.createTextNode(" @"));
    await editor.trigger("input");
    await wrapper.get("#agent-option-analyst").trigger("mousedown");
    expect(store.getAgentDetail.agentCode).toBe("analyst");
    editor.element.querySelector(".selected-agent")?.remove();
    await editor.trigger("input");
    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(wrapper.find(".selected-agent").exists()).toBe(false);
    expect(wrapper.findAll(".agent-slot-button")).toHaveLength(0);
  });

  it("hides incomplete agent identities while loading and shows the resolved name", async () => {
    const store = useChatStore(pinia);
    store.setAgentList([]);
    store.setAgentDetail({ agentCode: "analyst" } as AgentDetail);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");
    expect(editor.find(".selected-agent").exists()).toBe(false);
    expect(editor.text()).not.toContain("@undefined");
    store.getAgentDetail.agentName = "数据分析师";
    await wrapper.vm.$nextTick();
    expect(editor.get(".selected-agent").text()).toContain("@数据分析师");
    store.getAgentDetail.agentName = "   ";
    await wrapper.vm.$nextTick();
    expect(editor.find(".selected-agent").exists()).toBe(false);
  });

  it("uses the default without a mention when agents arrive asynchronously", async () => {
    const store = useChatStore(pinia);
    store.setAgentList([]);
    store.setAgentDetail({} as AgentDetail);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    store.setAgentList(agents);
    await wrapper.vm.$nextTick();
    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(wrapper.find(".selected-agent").exists()).toBe(false);
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

  it.each([
    "<br>",
    "<div><br></div>",
    '<span class="slot-placeholder"><br></span>',
    "\u2060<br>",
  ])(
    "cleans empty browser markup after selecting all and deleting: %s",
    async (markup) => {
      const store = useChatStore(pinia);
      store.setAgentDetail(agents[1]!);
      const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
      const editor = wrapper.get(".agent-mention-editor");
      expect(editor.find(".selected-agent").exists()).toBe(true);
      editor.element.innerHTML = markup;
      await editor.trigger("input", { inputType: "deleteContentBackward" });
      expect(editor.element.innerHTML).toBe("");
      expect(editor.classes()).toContain("empty");
      expect(store.getAgentDetail.agentCode).toBe("writer");
      await editor.trigger("keydown", { key: "Enter" });
      expect(wrapper.emitted("sendMessage")).toBeUndefined();
      editor.element.textContent = "重新输入";
      await editor.trigger("input");
      await editor.trigger("keydown", { key: "Enter" });
      expect(wrapper.emitted("sendMessage")?.[0]?.[0]).toBe("重新输入");
    },
  );

  it("preserves intentional empty lines when inserting a line break", async () => {
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = wrapper.get(".agent-mention-editor");
    editor.element.innerHTML = "<div><br></div>";
    await editor.trigger("input", { inputType: "insertLineBreak" });
    expect(editor.element.querySelector("br")).not.toBeNull();
  });

  it("returns to the default without restoring a deleted mention", async () => {
    const store = useChatStore(pinia);
    const wrapper = mount(ChatInput, { global: { plugins: [pinia] } });
    const editor = await mentionDefaultAgent(wrapper);

    editor.element.querySelector(".selected-agent")?.remove();
    await editor.trigger("input");

    expect(store.getAgentDetail.agentCode).toBe("writer");
    expect(editor.attributes("data-placeholder")).toBe("请输入...");
    expect(editor.find(".selected-agent").exists()).toBe(false);
  });
});
