// @vitest-environment happy-dom

import JSZip from "jszip";
import MarkdownIt from "markdown-it";
import { describe, expect, it } from "vitest";
import { registerMarkdownTable } from "./markdown-table";
import { prepareExportContent } from "./save-file";
import { createStandardDocxBlob } from "./docx-export";
import { createStandardXlsxBlob } from "./xlsx-export";
import { createHtmlBlob } from "./save-html";

const md = new MarkdownIt().use(registerMarkdownTable);
const longTable = `| 编号 | 内容 |\n| --- | --- |\n${Array.from(
  { length: 60 },
  (_, index) => `| ${index + 1} | 表格内容第${index + 1}行 |`,
).join("\n")}`;

describe("Markdown 表格", () => {
  it("每张表格有独立按钮，完整保留行和原有对齐属性", () => {
    const source = document.createElement("div");
    source.innerHTML = md.render(
      `${longTable}\n\n| 对齐 |\n| ---: |\n| 右对齐 |`,
    );
    expect(source.querySelectorAll(".markdown-table")).toHaveLength(2);
    expect(
      source.querySelectorAll("[data-markdown-table-preview]"),
    ).toHaveLength(2);
    expect(source.querySelector("table")!.rows).toHaveLength(61);
    expect(
      source.querySelectorAll("table")[1].querySelector("td")!.style.textAlign,
    ).toBe("right");
  });

  it("导出预处理仅在副本移除操作栏", async () => {
    const source = document.createElement("div");
    source.innerHTML = md.render(longTable);
    const { html } = await prepareExportContent(source);
    const exported = document.createElement("div");
    exported.innerHTML = html;
    expect(exported.querySelector("table")!.rows).toHaveLength(61);
    expect(exported.querySelector("button")).toBeNull();
    expect(exported.textContent).toContain("表格内容第60行");
    expect(source.querySelector("button")).not.toBeNull();
  });

  it("DOCX、HTML、XLSX 产物都包含完整首尾行", async () => {
    const source = document.createElement("div");
    source.innerHTML = md.render(longTable);
    const { html } = await prepareExportContent(source);
    const docx = await createStandardDocxBlob(html);
    const docxZip = await JSZip.loadAsync(await docx.arrayBuffer());
    const documentXml = await docxZip
      .file("word/document.xml")!
      .async("string");
    const xlsx = await createStandardXlsxBlob(html);
    const xlsxZip = await JSZip.loadAsync(await xlsx.arrayBuffer());
    const sharedStrings = await xlsxZip
      .file("xl/sharedStrings.xml")!
      .async("string");
    const exportedHtml = await createHtmlBlob(html).text();
    for (const content of [documentXml, sharedStrings, exportedHtml]) {
      expect(content).toContain("表格内容第1行");
      expect(content).toContain("表格内容第60行");
      expect(content).not.toContain("全屏查看");
    }
    expect(documentXml.match(/<w:tr>/g)).toHaveLength(61);
    expect(exportedHtml.match(/<tr>/g)).toHaveLength(61);
    const sheetXml = await xlsxZip
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    expect(sheetXml.match(/<row\b/g)).toHaveLength(61);
  });
});
