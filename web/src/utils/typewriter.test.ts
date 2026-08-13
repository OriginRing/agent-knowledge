// @vitest-environment happy-dom

import { message } from "ant-design-vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderMarkdown } from "./typewriter";

vi.mock("@antv/gpt-vis", () => ({
  GPTVis: class {
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

    expect(button?.textContent).toContain("已复制");
    expect(message.success).toHaveBeenCalledWith("已复制");
  });

  it("未标注语言时展示 text", () => {
    document.body.innerHTML = renderMarkdown("```\nplain text\n```");

    expect(document.querySelector(".markdown-code-language")?.textContent).toBe(
      "text",
    );
  });
});
