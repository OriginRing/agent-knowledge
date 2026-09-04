// @vitest-environment happy-dom

import { message } from "ant-design-vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderMarkdown, renderStreamingMarkdown } from "./typewriter";

const gptVisMocks = vi.hoisted(() => ({
  configs: [] as Array<{ width?: number }>,
}));

vi.mock("@antv/gpt-vis", () => ({
  GPTVis: class {
    constructor(config: { width?: number }) {
      gptVisMocks.configs.push(config);
    }

    destroy() {}
    render() {}
  },
}));

vi.mock("@view/stores/theme", () => ({
  useThemeStore: () => ({ getToggleDark: false }),
}));

vi.mock("ant-design-vue", () => ({
  message: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("Markdown 代码块", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    gptVisMocks.configs.length = 0;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("展示代码语言和复制按钮", () => {
    document.body.innerHTML = renderMarkdown(
      "```typescript\nconst n = 1;\n```",
    );

    expect(document.querySelector(".markdown-code-language")?.textContent).toBe(
      "typescript",
    );
    expect(
      document
        .querySelector<HTMLButtonElement>(".markdown-code-copy")
        ?.getAttribute("aria-label"),
    ).toBe("复制代码");
    expect(document.querySelector(".markdown-code-copy")?.textContent).toBe("");
    expect(
      document
        .querySelector<HTMLButtonElement>(".markdown-code-edit")
        ?.getAttribute("aria-label"),
    ).toBe("编辑代码");
  });

  it("复制代码并展示成功状态", async () => {
    document.body.innerHTML = renderMarkdown("```js\nconsole.log('ok');\n```");
    const button = document.querySelector<HTMLButtonElement>(
      ".markdown-code-copy",
    );

    button?.click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "console.log('ok');\n",
      );
      expect(button?.dataset.copied).toBe("true");
    });

    expect(button?.textContent).toBe("");
    expect(button?.getAttribute("aria-label")).toBe("代码已复制");
    expect(message.success).toHaveBeenCalledWith("已复制");
  });

  it("点击编辑按钮时传递完整代码与语言", () => {
    const onEdit = vi.fn();
    document.addEventListener("markdown-code-edit", onEdit, { once: true });
    document.body.innerHTML = renderMarkdown("```js\nconst n = 1;\n```");
    document.querySelector<HTMLButtonElement>(".markdown-code-edit")?.click();

    expect(onEdit).toHaveBeenCalledOnce();
    expect((onEdit.mock.calls[0]![0] as CustomEvent).detail).toEqual({
      id: expect.any(String),
      code: "const n = 1;\n",
      language: "js",
    });
    expect(document.querySelector("code")?.textContent).toBe("const n = 1;\n");
  });

  it("未标注语言时展示 text", () => {
    document.body.innerHTML = renderMarkdown("```\nplain text\n```");

    expect(document.querySelector(".markdown-code-language")?.textContent).toBe(
      "text",
    );
  });

  it("GPT-Vis 使用容器宽度而不是固定宽度", () => {
    const chart = document.createElement("gpt-vis");
    chart.dataset.syntax = encodeURIComponent("vis column\ndata:");
    vi.spyOn(chart, "getBoundingClientRect").mockReturnValue({
      width: 640,
    } as DOMRect);

    document.body.append(chart);

    expect(gptVisMocks.configs.at(-1)?.width).toBe(640);
  });
});

describe("流式文字渐变", () => {
  it("只为最后一段文字添加渐变尾巴", () => {
    document.body.innerHTML = renderStreamingMarkdown(
      "第一段\n\n最后一段正在流式输出文字",
      6,
    );

    const tail = document.querySelector(".streaming-text-tail");
    expect(tail?.textContent).toBe("流式输出文字");
    expect(document.querySelectorAll(".streaming-text-tail")).toHaveLength(1);
    expect(document.body.textContent).toContain(
      "第一段\n最后一段正在流式输出文字",
    );
  });

  it("不把代码块工具栏文字当作回答结尾", () => {
    document.body.innerHTML = renderStreamingMarkdown(
      "```ts\nconst answer = 42;\n```",
      4,
    );

    expect(
      document.querySelector(".streaming-text-tail")?.textContent,
    ).toContain("42;");
  });
});
