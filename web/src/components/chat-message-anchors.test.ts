// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import type { AgentChat } from "@view/interfaces/agent-interface";

import ChatMessageAnchors from "./chat-message-anchors.vue";

const messages: AgentChat[] = [
  { key: "system", role: "system", content: "欢迎" },
  { key: "user-1", role: "user", content: "第一个问题" },
  {
    key: "assistant-1",
    role: "assistant",
    content: "## 第一条回复\n\n这里是[链接](https://example.com)内容。",
  },
  { key: "user-2", role: "user", content: "第二个问题" },
  {
    key: "assistant-2",
    role: "assistant",
    content: "第二条回复",
  },
];

describe("ChatMessageAnchors", () => {
  it("仅为用户问题生成锚点，并标识当前项", () => {
    const wrapper = mount(ChatMessageAnchors, {
      props: { items: messages, activeKey: "user-2" },
    });

    const anchors = wrapper.findAll("button.message-anchor");
    expect(anchors).toHaveLength(2);
    expect(anchors[0].attributes("aria-label")).toContain("第一个问题");
    expect(anchors[1].attributes("aria-current")).toBe("location");
  });

  it("点击锚点时发送目标消息 key", async () => {
    const wrapper = mount(ChatMessageAnchors, {
      props: { items: messages },
    });

    await wrapper.findAll("button.message-anchor")[0].trigger("click");

    expect(wrapper.emitted("select")).toEqual([["user-1"]]);
  });

  it("只有一个问题时不显示位置导航", () => {
    const wrapper = mount(ChatMessageAnchors, {
      props: { items: messages.slice(0, 3) },
    });

    expect(wrapper.find("nav").exists()).toBe(false);
  });
});
