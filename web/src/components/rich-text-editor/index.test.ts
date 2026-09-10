// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file */

import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import type { Editor } from "@tiptap/vue-3";
import RichTextEditor from "./index.vue";
import type {
  RichTextEditorContent,
  RichTextEditorInputFormat,
} from "./content";

type RichTextEditorVm = {
  clearContent: () => void;
  editor: Editor;
  getContent: () => RichTextEditorContent;
  getHTML: () => string;
  getText: () => string;
  setContent: (content: string, format?: RichTextEditorInputFormat) => boolean;
};

const DefaultSlotStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("div", slots.default?.()),
});
const ButtonStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("button", [slots.icon?.(), slots.default?.()]),
});
const DropdownStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("div", [slots.default?.(), slots.overlay?.()]),
});
const PopoverStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("div", [slots.default?.(), slots.content?.()]),
});
const MenuItemStub = defineComponent({
  setup:
    (_, { slots }) =>
    () =>
      h("button", { class: "menu-item-stub" }, slots.default?.()),
});

const mountEditor = (props: Record<string, unknown> = {}) =>
  mount(RichTextEditor, {
    props,
    global: {
      stubs: {
        "a-button": ButtonStub,
        "a-dropdown": DropdownStub,
        "a-input": true,
        "a-menu": DefaultSlotStub,
        "a-menu-divider": true,
        "a-menu-item": MenuItemStub,
        "a-popover": PopoverStub,
        "a-tooltip": defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h("span", slots.default?.()),
        }),
        AlignCenterOutlined: true,
        BoldOutlined: true,
        CheckSquareOutlined: true,
        ClearOutlined: true,
        CodeOutlined: true,
        DownOutlined: true,
        FontColorsOutlined: true,
        FullscreenExitOutlined: true,
        FullscreenOutlined: true,
        HighlightOutlined: true,
        ItalicOutlined: true,
        LinkOutlined: true,
        MenuFoldOutlined: true,
        MenuUnfoldOutlined: true,
        OrderedListOutlined: true,
        RedoOutlined: true,
        StrikethroughOutlined: true,
        TableOutlined: true,
        UndoOutlined: true,
        UnderlineOutlined: true,
        UnorderedListOutlined: true,
      },
    },
  });

describe("RichTextEditor", () => {
  it("可用 Markdown 初始化公共编辑器内容", async () => {
    const wrapper = mountEditor({
      initialContent: "## 回答标题\n\n回答正文",
      initialFormat: "markdown",
    });
    await nextTick();

    const vm = wrapper.vm as unknown as RichTextEditorVm;
    expect(vm.getHTML()).toContain("<h2>回答标题</h2>");
    expect(vm.getText()).toBe("回答标题\n\n回答正文");
  });

  it("可接收并保留 HTML 图片节点", async () => {
    const wrapper = mountEditor({
      initialContent:
        '<p>图表</p><img src="data:image/png;base64,chart" alt="GPT-Vis 图表" width="620">',
      initialFormat: "html",
    });
    await nextTick();

    const vm = wrapper.vm as unknown as RichTextEditorVm;
    expect(vm.getHTML()).toContain('src="data:image/png;base64,chart"');
    expect(vm.getHTML()).toContain('alt="GPT-Vis 图表"');
    expect(vm.getHTML()).toContain('width="620"');
  });

  it("同步纯文本、清除列表格式并响应禁用状态", async () => {
    const wrapper = mountEditor();
    const editor = (wrapper.vm as unknown as RichTextEditorVm).editor;

    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "偏好中文" }],
                },
              ],
            },
          ],
        },
      ],
    });
    await nextTick();

    expect(wrapper.emitted("update:text")?.at(-1)).toEqual(["- 偏好中文"]);
    expect(wrapper.get(".editor-meta").text()).toBe("6 字");

    await wrapper.get('[aria-label="清除格式"]').trigger("click");
    expect(editor.isActive("bulletList")).toBe(false);
    expect(wrapper.emitted("update:text")?.at(-1)).toEqual(["偏好中文"]);

    await wrapper.setProps({ disabled: true });
    expect(editor.isEditable).toBe(false);
  });

  it("卸载组件时销毁编辑器", () => {
    const wrapper = mountEditor();
    const editor = (wrapper.vm as unknown as RichTextEditorVm).editor;
    const destroy = vi.spyOn(editor, "destroy");

    wrapper.unmount();

    expect(destroy).toHaveBeenCalledOnce();
  });

  it("提供标题、文字样式、引用和代码工具", async () => {
    const wrapper = mountEditor();
    const editor = (wrapper.vm as unknown as RichTextEditorVm).editor;

    for (const label of [
      "选择标题级别",
      "切换粗体",
      "切换下划线",
      "切换斜体",
      "切换删除线",
      "切换行内代码",
      "切换引用",
      "切换任务清单",
      "降低列表层级",
      "增加列表层级",
      "设置链接",
      "文字对齐",
      "文字颜色",
      "文字高亮",
      "设置字号",
      "设置字体",
      "设置行高",
      "全屏编辑",
    ]) {
      expect(wrapper.find(`[aria-label="${label}"]`).exists()).toBe(true);
    }

    const heading6 = wrapper
      .findAll(".menu-item-stub")
      .find((item) => item.text().trim() === "H6 标题");
    expect(heading6).toBeDefined();
    await heading6?.trigger("click");
    expect(editor.isActive("heading", { level: 6 })).toBe(true);
    expect(wrapper.get('[aria-label="选择标题级别"]').text()).toContain("H6");
    await wrapper.get('[aria-label="切换粗体"]').trigger("click");
    expect(editor.isActive("bold")).toBe(true);
    await wrapper.get('[aria-label="切换引用"]').trigger("click");
    expect(editor.isActive("blockquote")).toBe(true);
  });

  it("让各工具逐项参与整行换行并保留分组边界", () => {
    const wrapper = mountEditor();

    expect(wrapper.findAll('.toolbar-group[role="group"]')).toHaveLength(6);
    expect(wrapper.findAll(".toolbar-group-first")).toHaveLength(5);
  });

  it("使用不显示颜色名称的四行色板设置文字颜色和高亮", async () => {
    const wrapper = mountEditor();
    const editor = (wrapper.vm as unknown as RichTextEditorVm).editor;
    const textRed = wrapper.get('[aria-label="文字颜色：红色"]');
    const highlightBlue = wrapper.get('[aria-label="高亮颜色：浅蓝色"]');

    expect(wrapper.findAll(".rich-text-color-menu")).toHaveLength(2);
    expect(wrapper.findAll(".color-palette-item")).toHaveLength(48);
    expect(textRed.text()).toBe("");
    expect(highlightBlue.text()).toBe("");

    await textRed.trigger("click");
    expect(editor.getAttributes("textStyle").color).toBe("#f5222d");
    await highlightBlue.trigger("click");
    expect(editor.getAttributes("textStyle").backgroundColor).toBe("#e6f4ff");
  });

  it("应用下划线、链接、颜色、字号、字体、行高和对齐并保留 HTML", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as RichTextEditorVm;
    const editor = vm.editor;

    editor.commands.setContent("偏好中文");
    editor.commands.selectAll();
    editor
      .chain()
      .setUnderline()
      .setLink({ href: "https://example.com" })
      .setColor("#cf1322")
      .setBackgroundColor("#fff1b8")
      .setFontSize("20px")
      .setFontFamily("SimSun, serif")
      .setLineHeight("2")
      .setTextAlign("center")
      .run();
    await nextTick();

    expect(vm.getHTML()).toContain("text-align: center");
    expect(vm.getHTML()).toContain('href="https://example.com"');
    expect(vm.getHTML()).toContain("color: #cf1322");
    expect(vm.getHTML()).toContain("background-color: #fff1b8");
    expect(vm.getHTML()).toContain("font-size: 20px");
    expect(vm.getHTML()).toContain("font-family: SimSun, serif");
    expect(vm.getHTML()).toContain("line-height: 2");
    expect(vm.getHTML()).toContain("<u>");
    expect(vm.getText()).toBe("偏好中文");
  });

  it("切换全屏并支持 Escape 退出", async () => {
    const wrapper = mountEditor();

    await wrapper.get('[aria-label="全屏编辑"]').trigger("click");
    expect(wrapper.classes()).toContain("is-fullscreen");

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();
    expect(wrapper.classes()).not.toContain("is-fullscreen");
  });

  it("通过公开方法赋值 HTML 并同时输出 HTML 和纯文本", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as RichTextEditorVm;

    expect(
      vm.setContent(
        "<h2>回复偏好</h2><p>使用<strong>中文</strong>回答</p>",
        "html",
      ),
    ).toBe(true);
    await nextTick();

    expect(vm.getContent()).toEqual({
      html: "<h2>回复偏好</h2><p>使用<strong>中文</strong>回答</p>",
      text: "回复偏好\n\n使用中文回答",
    });
    expect(wrapper.emitted("update:html")?.at(-1)).toEqual([
      "<h2>回复偏好</h2><p>使用<strong>中文</strong>回答</p>",
    ]);
    expect(wrapper.emitted("update:text")?.at(-1)).toEqual([
      "回复偏好\n\n使用中文回答",
    ]);
    expect(vm.getHTML()).toBe(
      "<h2>回复偏好</h2><p>使用<strong>中文</strong>回答</p>",
    );
    expect(vm.getText()).toBe("回复偏好\n\n使用中文回答");
  });

  it("支持 Markdown 和安全的纯文本赋值", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as RichTextEditorVm;

    vm.setContent("# 个人偏好\n\n使用 **中文** 回答", "markdown");
    await nextTick();
    expect(vm.getContent()).toEqual({
      html: "<h1>个人偏好</h1><p>使用 <strong>中文</strong> 回答</p>",
      text: "个人偏好\n\n使用 中文 回答",
    });

    vm.setContent("<strong>普通文本</strong>\n第二行", "text");
    await nextTick();
    expect(vm.getContent()).toEqual({
      html: "<p>&lt;strong&gt;普通文本&lt;/strong&gt;<br>第二行</p>",
      text: "<strong>普通文本</strong>\n第二行",
    });

    vm.clearContent();
    await nextTick();
    expect(vm.getContent().text).toBe("");
  });

  it("支持表格工具并以 HTML 和可读纯文本输出表格", async () => {
    const wrapper = mountEditor();
    const vm = wrapper.vm as unknown as RichTextEditorVm;

    expect(wrapper.find('[aria-label="表格操作"]').exists()).toBe(true);
    expect(
      vm.setContent(
        "<table><tbody><tr><th><p>偏好</p></th><th><p>内容</p></th></tr><tr><td><p>语言</p></td><td><p>中文</p></td></tr></tbody></table>",
        "html",
      ),
    ).toBe(true);
    await nextTick();

    expect(vm.getHTML()).toContain("<table");
    expect(vm.getHTML()).toContain("<th");
    expect(vm.getText()).toBe("偏好 | 内容\n语言 | 中文");
  });
});
