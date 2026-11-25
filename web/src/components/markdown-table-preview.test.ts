// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import MarkdownIt from "markdown-it";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerMarkdownTable } from "@view/utils/markdown-table";
import MarkdownTablePreview from "./markdown-table-preview.vue";

const md = new MarkdownIt().use(registerMarkdownTable);
const markdown = (name: string) => `| 名称 |\n| --- |\n| ${name} |`;
let wrapper: ReturnType<typeof mount>;

function appendTables() {
  const source = document.createElement("div");
  source.innerHTML =
    md.render(markdown("第一张")) + md.render(markdown("第二张"));
  document.body.append(source);
  return source;
}

afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = "";
});

describe("Markdown 表格全屏预览", () => {
  it("全文搜索高亮并循环上下跳转，支持键盘、无匹配与清空", async () => {
    wrapper = mount(MarkdownTablePreview, {
      attachTo: document.body,
      global: { stubs: { transition: false } },
    });
    const source = appendTables();
    source.innerHTML = md.render(
      "| 名称 |\n| --- |\n| Alpha Alpha |\n| alpha |",
    );
    source.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    await vi.waitFor(() =>
      expect(
        document.querySelector('input[aria-label="搜索表格全文"]'),
      ).not.toBeNull(),
    );
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="搜索表格全文"]',
    )!;
    expect(input.closest(".ant-modal-header")).not.toBeNull();
    const search = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await nextTick();
    };
    const active = () =>
      document.querySelector<HTMLElement>("mark.is-active")?.dataset.tableMatch;
    const previous = document.querySelector<HTMLButtonElement>(
      '[aria-label="上一个匹配"]',
    )!;
    const next = document.querySelector<HTMLButtonElement>(
      '[aria-label="下一个匹配"]',
    )!;
    await search("alpha");
    expect(document.querySelectorAll("mark[data-table-match]")).toHaveLength(3);
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "1 / 3",
    );
    expect(active()).toBe("0");
    previous.click();
    expect(active()).toBe("2");
    next.click();
    expect(active()).toBe("0");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(active()).toBe("1");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey: true,
        bubbles: true,
      }),
    );
    expect(active()).toBe("0");
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        isComposing: true,
        bubbles: true,
      }),
    );
    expect(active()).toBe("0");
    expect(source.querySelector("mark")).toBeNull();
    await search("不存在");
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      "无匹配",
    );
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(true);
    await search("");
    expect(document.querySelector("mark[data-table-match]")).toBeNull();
    expect(
      document.querySelector(".markdown-table-preview-content")?.textContent,
    ).toContain("Alpha Alpha");
  });

  it("委托处理延后插入的表格，预览独立快照并恢复按钮焦点", async () => {
    wrapper = mount(MarkdownTablePreview, {
      attachTo: document.body,
      global: { stubs: { transition: false } },
    });
    const source = appendTables();
    const buttons = source.querySelectorAll<HTMLButtonElement>("button");
    buttons[1].click();
    await nextTick();
    await vi.waitFor(() =>
      expect(
        document.querySelector(".markdown-table-preview-content table"),
      ).not.toBeNull(),
    );
    const preview = document.querySelector(".markdown-table-preview-content")!;
    expect(preview.textContent).toContain("第二张");
    expect(preview.textContent).not.toContain("第一张");
    source.querySelectorAll("td")[1].textContent = "更新后的内容";
    expect(preview.textContent).toContain("第二张");
    expect(source.querySelectorAll("table")).toHaveLength(2);

    document
      .querySelector<HTMLButtonElement>('[aria-label="退出全屏表格"]')!
      .click();
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[1]));
    expect(
      document.querySelector(".markdown-table-preview-content"),
    ).toBeNull();

    buttons[1].click();
    await nextTick();
    await vi.waitFor(() =>
      expect(
        document.querySelector(".markdown-table-preview-content")?.textContent,
      ).toContain("更新后的内容"),
    );
    const modal = document.querySelector(".markdown-table-preview-modal")!;
    modal.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        bubbles: true,
      }),
    );
    await vi.waitFor(() => expect(document.activeElement).toBe(buttons[1]));
  });

  it("卸载清理事件、浮层和滚动锁，来源移除后仍可关闭", async () => {
    wrapper = mount(MarkdownTablePreview, {
      attachTo: document.body,
      global: { stubs: { transition: false } },
    });
    const source = appendTables();
    source.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    await vi.waitFor(() =>
      expect(getComputedStyle(document.body).overflowY).toBe("hidden"),
    );
    source.remove();
    document
      .querySelector<HTMLButtonElement>('[aria-label="退出全屏表格"]')!
      .click();
    await vi.waitFor(() =>
      expect(getComputedStyle(document.body).overflowY).not.toBe("hidden"),
    );
    const nextSource = appendTables();
    nextSource.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    await vi.waitFor(() =>
      expect(getComputedStyle(document.body).overflowY).toBe("hidden"),
    );
    const remove = vi.spyOn(document, "removeEventListener");
    wrapper.unmount();
    expect(remove).toHaveBeenCalledWith("click", expect.any(Function));
    remove.mockRestore();
    await vi.waitFor(() =>
      expect(getComputedStyle(document.body).overflowY).not.toBe("hidden"),
    );
    expect(document.querySelector(".markdown-table-preview-modal")).toBeNull();
    nextSource.querySelector<HTMLButtonElement>("button")!.click();
    await nextTick();
    expect(document.querySelector(".markdown-table-preview-modal")).toBeNull();
  });
});
