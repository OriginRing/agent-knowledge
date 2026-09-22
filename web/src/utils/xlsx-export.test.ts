// @vitest-environment happy-dom

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createStandardXlsxBlob } from "./xlsx-export";

describe("XLSX 导出", () => {
  it("生成限定为 A4 横向一页宽且纵向可分页的工作表", async () => {
    const blob = await createStandardXlsxBlob(`
      <h1>销售报告</h1>
      <p>本月销售趋势稳定。</p>
      <table>
        <tr><th>区域</th><th>销售额</th></tr>
        <tr><td>华东</td><td>120</td></tr>
      </table>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const worksheetXml = await archive
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");
    const workbookXml = await archive.file("xl/workbook.xml")!.async("string");

    expect(worksheetXml).toContain('paperSize="9"');
    expect(worksheetXml).toContain('orientation="landscape"');
    expect(worksheetXml).toContain('width="14"');
    expect(worksheetXml).toContain('fitToWidth="1"');
    expect(worksheetXml).toContain('fitToHeight="0"');
    expect(worksheetXml).toContain('fitToPage="1"');
    expect(workbookXml).toContain("_xlnm.Print_Area");
    expect(workbookXml).toMatch(/\$A\$?1:\$H\$?4/);
    expect(sharedStringsXml).toContain("销售报告");
    expect(sharedStringsXml).toContain("华东");
    expect(worksheetXml).toMatch(/<c r="B4"[^>]*><v>120<\/v><\/c>/);
  });

  it("宽表格仍限制为单页横向宽度", async () => {
    const cells = Array.from(
      { length: 12 },
      (_, index) => `<td>${index}</td>`,
    ).join("");
    const blob = await createStandardXlsxBlob(
      `<table><tr>${cells}</tr></table>`,
    );
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const worksheetXml = await archive
      .file("xl/worksheets/sheet1.xml")!
      .async("string");

    expect(worksheetXml).toContain('<dimension ref="A1:L1"');
    expect(worksheetXml).toContain('fitToWidth="1"');
    expect(worksheetXml).toContain('fitToHeight="0"');
  });
});
