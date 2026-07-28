// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file */

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computed,
  defineComponent,
  h,
  inject,
  nextTick,
  provide,
  type ComputedRef,
  type VNodeChild,
} from "vue";

import type { ChatNode } from "@view/interfaces/agent-interface";

vi.mock("@ant-design/icons-vue", async () => {
  const { defineComponent, h } = await import("vue");
  const icon = (name: string) =>
    defineComponent({
      name,
      setup: () => () => h("span", { class: `icon-${name}` }),
    });
  return {
    BulbOutlined: icon("bulb"),
    CheckCircleOutlined: icon("check"),
    CloseCircleOutlined: icon("close"),
    FileOutlined: icon("file"),
    LoadingOutlined: icon("loading"),
    MinusCircleOutlined: icon("minus"),
    StopOutlined: icon("stop"),
  };
});

vi.mock("ant-design-vue", async () => {
  const { defineComponent, h } = await import("vue");
  const slotComponent = (name: string, tag = "div") =>
    defineComponent({
      name,
      setup(_, { slots }) {
        return () => h(tag, slots.default?.());
      },
    });
  return {
    Button: slotComponent("Button", "button"),
    Flex: slotComponent("Flex"),
    Tag: slotComponent("Tag", "span"),
    TypographyText: slotComponent("TypographyText", "span"),
    message: {
      loading: () => () => undefined,
      error: vi.fn(),
    },
  };
});

vi.mock("ant-design-x-vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    ThoughtChain: defineComponent({
      name: "ThoughtChain",
      props: {
        items: { type: Array, default: () => [] },
        collapsible: { type: Object, default: () => ({}) },
      },
      setup(props) {
        return () =>
          h(
            "div",
            { class: "ant-thought-chain" },
            (
              props.items as Array<{
                key: string;
                title: string;
                content?: VNodeChild;
              }>
            ).map((item) => {
              const expandedKeys =
                (props.collapsible as { expandedKeys?: string[] })
                  .expandedKeys ?? [];
              const expanded = expandedKeys.includes(item.key);
              return h("div", { class: "ant-thought-chain-item" }, [
                h(
                  "button",
                  {
                    class: "ant-thought-chain-item-header",
                    onClick: () => {
                      const nextKeys = expanded
                        ? expandedKeys.filter((key) => key !== item.key)
                        : [...expandedKeys, item.key];
                      (
                        props.collapsible as {
                          onExpand?: (keys: string[]) => void;
                        }
                      ).onExpand?.(nextKeys);
                    },
                  },
                  item.title,
                ),
                h(
                  "div",
                  {
                    class: "ant-thought-chain-item-content",
                    style: { display: expanded ? "" : "none" },
                  },
                  [item.content],
                ),
              ]);
            }),
          );
      },
    }),
  };
});

vi.mock("@view/utils/typewriter", () => ({
  renderMarkdown: (content: string) => content,
}));

import ChatThoughtChain from "./chat-thought-chain.vue";

const collapseContextKey = Symbol("collapse-context");
type CollapseContext = {
  active: ComputedRef<boolean>;
  toggle: () => void;
};

const CollapseStub = defineComponent({
  name: "ACollapse",
  props: {
    activeKey: { type: Array<string>, default: () => [] },
  },
  emits: ["update:activeKey"],
  setup(props, { emit, slots }) {
    const active = computed(() => props.activeKey.includes("chain"));
    provide(collapseContextKey, {
      active,
      toggle: () => emit("update:activeKey", active.value ? [] : ["chain"]),
    });
    return () => h("div", { class: "thought-chain-shell" }, slots.default?.());
  },
});

const CollapsePanelStub = defineComponent({
  name: "ACollapsePanel",
  setup(_, { slots }) {
    const context = inject<CollapseContext>(collapseContextKey);
    return () =>
      h(
        "div",
        {
          class: [
            "ant-collapse-item",
            context?.active.value && "ant-collapse-item-active",
          ],
        },
        [
          h(
            "button",
            {
              class: "ant-collapse-header",
              onClick: context?.toggle,
            },
            slots.header?.(),
          ),
          h(
            "div",
            {
              class: [
                "ant-collapse-content",
                context?.active.value && "ant-collapse-content-active",
              ],
              style: { display: context?.active.value ? "" : "none" },
            },
            slots.default?.(),
          ),
        ],
      );
  },
});

const skillNode: ChatNode = {
  id: "skill-summary",
  kind: "skill",
  name: "skill",
  title: "已启用 2 个技能",
  summary: "已启用 2 个技能",
  status: "success",
  details: {
    skills: ["web-search", "artifact-generator"],
  },
};

const modelNode: ChatNode = {
  id: "model-call",
  kind: "model",
  name: "model",
  title: "模型调用",
  summary: "模型调用",
  status: "running",
  details: {
    reasoning: "正在整理回答",
  },
};

function mountThoughtChain(props: {
  nodes: ChatNode[];
  active: boolean;
  messageStatus?: "running" | "complete" | "error" | "cancelled";
}) {
  return mount(ChatThoughtChain, {
    props,
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
      components: {
        ACollapse: CollapseStub,
        ACollapsePanel: CollapsePanelStub,
        AFlex: {
          template: "<div><slot /></div>",
        },
      },
    },
  });
}

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("ChatThoughtChain", () => {
  it("运行时展开整链和节点，显示技能名称并在终态自动折叠", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-28T06:00:00.000Z"));

    const wrapper = mountThoughtChain({
      nodes: [skillNode, modelNode],
      active: true,
      messageStatus: "running",
    });
    await nextTick();

    expect(wrapper.text()).toContain("思考中...");
    expect(wrapper.text()).toContain("联网搜索");
    expect(wrapper.text()).toContain("文件生成");
    expect(wrapper.find(".ant-collapse-content-active").exists()).toBe(true);

    vi.advanceTimersByTime(1250);
    await nextTick();
    expect(wrapper.find(".thought-chain-timer").text()).toBe("1.2s");

    const innerHeaders = wrapper.findAll(".ant-thought-chain-item-header");
    expect(innerHeaders.length).toBe(2);
    await innerHeaders[0].trigger("click");
    await nextTick();
    expect(
      wrapper.findAll(".ant-thought-chain-item-content")[0].attributes("style"),
    ).toContain("display: none");

    await wrapper.setProps({
      active: false,
      messageStatus: "complete",
    });
    await nextTick();

    expect(wrapper.text()).toContain("思考完成");
    const finalTimer = wrapper.find(".thought-chain-timer").text();
    expect(finalTimer).toBe("1.3s");
    expect(
      wrapper.find(".thought-chain-shell > .ant-collapse-item").classes(),
    ).not.toContain("ant-collapse-item-active");

    vi.advanceTimersByTime(1000);
    await nextTick();
    expect(wrapper.find(".thought-chain-timer").text()).toBe(finalTimer);

    const outerHeader = wrapper.find(
      ".thought-chain-shell > .ant-collapse-item > .ant-collapse-header",
    );
    await outerHeader.trigger("click");
    await nextTick();
    expect(
      wrapper.find(".thought-chain-shell > .ant-collapse-item").classes(),
    ).toContain("ant-collapse-item-active");
    wrapper.findAll(".ant-thought-chain-item-content").forEach((content) => {
      expect(content.attributes("style")).toContain("display: none");
    });

    wrapper.unmount();
  });

  it.each([
    ["error", "思考遇到问题"],
    ["cancelled", "中断思考"],
  ] as const)(
    "终态 %s 使用对应文案并自动折叠",
    async (messageStatus, label) => {
      const wrapper = mountThoughtChain({
        nodes: [modelNode],
        active: true,
        messageStatus: "running",
      });
      await nextTick();

      await wrapper.setProps({
        active: false,
        messageStatus,
      });
      await nextTick();

      expect(wrapper.text()).toContain(label);
      expect(
        wrapper.find(".thought-chain-shell > .ant-collapse-item").classes(),
      ).not.toContain("ant-collapse-item-active");
      wrapper.unmount();
    },
  );

  it("历史终态消息不启动或展示页面计时", async () => {
    vi.useFakeTimers();

    const wrapper = mountThoughtChain({
      nodes: [skillNode],
      active: false,
      messageStatus: "complete",
    });
    await nextTick();
    vi.advanceTimersByTime(5000);
    await nextTick();

    expect(wrapper.text()).toContain("思考完成");
    expect(wrapper.find(".thought-chain-timer").exists()).toBe(false);
    expect(
      wrapper.find(".thought-chain-shell > .ant-collapse-item").classes(),
    ).not.toContain("ant-collapse-item-active");
    wrapper.unmount();
  });
});
