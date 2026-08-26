// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from "vitest";

const echartsMocks = vi.hoisted(() => {
  const dispose = vi.fn();
  const resize = vi.fn();
  const setOption = vi.fn();
  const init = vi.fn(() => ({ dispose, resize, setOption }));
  return { dispose, init, resize, setOption };
});

vi.mock("echarts", () => ({ init: echartsMocks.init }));

vi.mock("@view/utils/copy", () => ({
  copyToClipboard: vi.fn().mockResolvedValue(true),
}));

import { renderMarkdown, renderStreamingMarkdown } from "./echarts-typewriter";

describe("ECharts Markdown", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    document.documentElement.classList.remove("dark");
    vi.clearAllMocks();
  });

  it("把 echarts 围栏渲染为图表", () => {
    document.body.innerHTML = renderMarkdown(
      '```echarts\n{"xAxis":{"type":"category","data":["一月"]},"series":[{"type":"bar","data":[12]}]}\n```',
    );

    expect(document.querySelector("gpt-vis")).toBeNull();
    expect(document.querySelector("echarts-chart")).not.toBeNull();
    expect(echartsMocks.init).toHaveBeenCalledTimes(1);
    expect(echartsMocks.setOption).toHaveBeenCalledWith(
      expect.objectContaining({ series: [{ type: "bar", data: [12] }] }),
      { notMerge: true },
    );
  });

  it("支持 option 赋值外壳和自定义高度", () => {
    document.body.innerHTML = renderMarkdown(
      '```echarts height=560\noption = {"series":[{"type":"pie","data":[]} ]};\n```',
    );

    const chart = document.querySelector("echarts-chart");
    expect(chart?.getAttribute("data-height")).toBe("560");
    expect(
      chart?.querySelector<HTMLElement>(".echarts-chart-canvas")?.style.height,
    ).toBe("560px");
    expect(echartsMocks.setOption).toHaveBeenCalled();
  });

  it("配置不是合法 JSON 时显示错误而不执行图表", () => {
    document.body.innerHTML = renderMarkdown(
      "```echarts\n{ series: [{ type: 'line' }] }\n```",
    );

    const chart = document.querySelector("echarts-chart");
    expect(chart?.getAttribute("data-error")).toBe("true");
    expect(chart?.textContent).toContain("ECharts 配置解析失败");
    expect(echartsMocks.init).not.toHaveBeenCalled();
  });

  it("普通代码块仍按代码渲染", () => {
    document.body.innerHTML = renderMarkdown("```ts\nconst n = 1;\n```");

    expect(document.querySelector("echarts-chart")).toBeNull();
    expect(document.querySelector(".markdown-code-language")?.textContent).toBe(
      "ts",
    );
    expect(document.querySelector("code")?.textContent).toBe("const n = 1;\n");
  });

  it("流式渐变不进入图表节点", () => {
    document.body.innerHTML = renderStreamingMarkdown(
      '图表如下\n\n```echarts\n{"series":[]}\n```',
      4,
    );

    expect(
      document.querySelector("echarts-chart .streaming-text-tail"),
    ).toBeNull();
    expect(document.querySelector(".streaming-text-tail")?.textContent).toBe(
      "图表如下",
    );
  });
});
