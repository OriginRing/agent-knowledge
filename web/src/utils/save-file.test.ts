// @vitest-environment happy-dom

import { snapdom } from "@zumer/snapdom";
import { message } from "ant-design-vue";
import { saveAs } from "file-saver";
import { asBlob } from "html-docx-js-typescript";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { prepareDocxContent, saveDocx } from "./save-file";

vi.mock("@zumer/snapdom", () => ({
  snapdom: vi.fn(),
}));

vi.mock("ant-design-vue", () => ({
  message: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("file-saver", () => ({
  saveAs: vi.fn(),
}));

vi.mock("html-docx-js-typescript", () => ({
  asBlob: vi.fn(),
}));

const mockedSnapdom = vi.mocked(snapdom);
const mockedAsBlob = vi.mocked(asBlob);
const mockedSaveAs = vi.mocked(saveAs);
const mockedWarning = vi.mocked(message.warning);
const mockedError = vi.mocked(message.error);

function appendMessage(html: string) {
  const element = document.createElement("div");
  element.id = "assistant-message";
  element.innerHTML = html;
  document.body.appendChild(element);
  return element;
}

function pngResult(src: string) {
  return {
    toPng: vi
      .fn()
      .mockResolvedValue(Object.assign(document.createElement("img"), { src })),
  };
}

describe("Word 下载", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
    mockedAsBlob.mockResolvedValue(new Blob(["docx"]));
  });

  it("无图表时保留正文并且不调用截图", async () => {
    const source = appendMessage('<p class="content">销售趋势稳定</p>');

    const result = await prepareDocxContent(source);

    expect(result.failedChartCount).toBe(0);
    expect(result.html).toContain("销售趋势稳定");
    expect(mockedSnapdom).not.toHaveBeenCalled();
  });

  it("按顺序将多个 GPT-Vis 图表替换为 PNG 且不修改原始 DOM", async () => {
    const source = appendMessage(`
      <p>第一张</p>
      <gpt-vis>
        <div class="gpt-vis-wrapper-header">工具栏</div>
        <div class="gpt-vis-wrapper-chart-container">图表一</div>
      </gpt-vis>
      <p>第二张</p>
      <gpt-vis>
        <div class="gpt-vis-wrapper-chart-container">图表二</div>
        <div class="gpt-vis-wrapper-code">源码</div>
      </gpt-vis>
    `);
    mockedSnapdom
      .mockResolvedValueOnce(pngResult("data:image/png;base64,first") as never)
      .mockResolvedValueOnce(
        pngResult("data:image/png;base64,second") as never,
      );

    const result = await prepareDocxContent(source);

    expect(mockedSnapdom).toHaveBeenCalledTimes(2);
    expect(mockedSnapdom.mock.calls[0][0].textContent).toContain("图表一");
    expect(mockedSnapdom.mock.calls[0][1]).toEqual({ scale: 2 });
    expect(result.html).not.toContain("<gpt-vis");
    expect(result.html).not.toContain("工具栏");
    expect(result.html).not.toContain("源码");
    expect(result.html.indexOf("first")).toBeLessThan(
      result.html.indexOf("second"),
    );
    expect(result.html).toContain('width="620"');
    expect(source.querySelectorAll("gpt-vis")).toHaveLength(2);
    expect(source.querySelector("img")).toBeNull();
  });

  it("图表截图失败时保留占位并继续生成 Word", async () => {
    appendMessage(`
      <gpt-vis>
        <div class="gpt-vis-wrapper-chart-container">成功图表</div>
      </gpt-vis>
      <gpt-vis>
        <div class="gpt-vis-wrapper-chart-container">失败图表</div>
      </gpt-vis>
    `);
    mockedSnapdom
      .mockResolvedValueOnce(pngResult("data:image/png;base64,ok") as never)
      .mockRejectedValueOnce(new Error("capture failed"));

    await saveDocx("assistant-message", "report.docx");

    const exportedHtml = String(mockedAsBlob.mock.calls[0][0]);
    expect(exportedHtml).toContain("data:image/png;base64,ok");
    expect(exportedHtml).toContain("图表导出失败");
    expect(mockedSaveAs).toHaveBeenCalledWith(expect.any(Blob), "report.docx");
    expect(mockedWarning).toHaveBeenCalledWith(
      "1 个图表未能导出，已在 Word 中标注",
    );
  });

  it("全部图表成功时生成 Word 且不显示警告", async () => {
    const source = appendMessage(`
      <img src="data:image/png;base64,original" style="width: 40px">
      <gpt-vis>
        <div class="gpt-vis-wrapper-chart-container">图表</div>
      </gpt-vis>
    `);
    mockedSnapdom.mockResolvedValue(
      pngResult("data:image/png;base64,chart") as never,
    );

    await saveDocx("assistant-message", "report.docx");

    expect(mockedSaveAs).toHaveBeenCalledOnce();
    expect(mockedWarning).not.toHaveBeenCalled();
    expect(source.querySelector("img")?.style.width).toBe("40px");
  });

  it("Word 生成失败时提示错误且不触发下载", async () => {
    appendMessage("<p>正文</p>");
    mockedAsBlob.mockRejectedValue(new Error("docx failed"));

    await saveDocx("assistant-message", "report.docx");

    expect(mockedSaveAs).not.toHaveBeenCalled();
    expect(mockedError).toHaveBeenCalledWith("导出 Word 失败，请稍后重试");
  });
});
