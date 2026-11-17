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

  it("只保留基础表格样式，丢弃底色与字色", async () => {
    const blob = await createStandardXlsxBlob(`
      <table style="border-collapse:collapse">
        <caption>销售明细</caption>
        <tr style="background:#1f3a5f">
          <th style="border:1px solid #1f3a5f;color:#ffffff;font-weight:700;text-align:center">区域</th>
          <th style="border:1px solid #1f3a5f;color:#ffffff;text-align:center">销售额</th>
        </tr>
        <tr>
          <td style="border:1px solid #d0d7de;background:#fff7e6;text-align:left">华东</td>
          <td style="border:1px solid #d0d7de;color:#cf1322;text-align:right">120,000</td>
        </tr>
      </table>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const stylesXml = await archive.file("xl/styles.xml")!.async("string");
    const sheetXml = await archive
      .file("xl/worksheets/sheet1.xml")!
      .async("string");

    // 底色、字色、字号、自定义边框都不导出
    expect(stylesXml).not.toContain('rgb="FF1F3A5F"');
    expect(stylesXml).not.toContain('rgb="FFFFF7E6"');
    expect(stylesXml).not.toContain('rgb="FFCF1322"');
    expect(stylesXml).not.toContain('rgb="FFD0D7DE"');
    expect(stylesXml).not.toContain('<patternFill patternType="solid">');
    // 只保留基础样式：统一细边框、表头加粗、按源对齐
    expect(stylesXml).toMatch(/<left style="thin"><color rgb="FFBFBFBF"\/>/);
    expect(stylesXml).toMatch(/<b\/><color rgb="FF1F1F1F"\/><sz val="11"\/>/);
    expect(stylesXml).toContain('<alignment horizontal="right"');
    expect(stylesXml).toContain('<alignment horizontal="left"');
    // 标题行导出为合并的加粗行
    expect(sheetXml).toContain('<mergeCell ref="A1:H1"/>');
  });

  it("单元格内只保留加粗，不保留字色", async () => {
    const blob = await createStandardXlsxBlob(`
      <table>
        <tr>
          <td><strong>华南</strong><span style="color:#cf1322">重点</span></td>
        </tr>
      </table>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");

    expect(sharedStringsXml).toMatch(/<r><rPr><b\/>/);
    expect(sharedStringsXml).not.toContain('rgb="FFCF1322"');
    expect(sharedStringsXml).toContain("华南");
    expect(sharedStringsXml).toContain("重点");
  });

  it("没有样式的表格沿用默认细边框", async () => {
    const blob = await createStandardXlsxBlob(`
      <table><tr><td>华东</td></tr></table>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const stylesXml = await archive.file("xl/styles.xml")!.async("string");

    expect(stylesXml).toMatch(/<left style="thin"><color rgb="FFBFBFBF"\/>/);
  });

  it("表格被 div 包裹时仍按表格导出", async () => {
    const blob = await createStandardXlsxBlob(`
      <div class="demo-card">
        <div class="demo-body">
          <table>
            <tr><th>区域</th><th>销售额</th></tr>
            <tr><td>华东</td><td>120</td></tr>
          </table>
        </div>
      </div>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sheetXml = await archive
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");

    expect(sheetXml).toMatch(/<c r="B2"[^>]*><v>120<\/v><\/c>/);
    expect(sharedStringsXml).toContain("区域");
    expect(sharedStringsXml).toContain("华东");
    // 不能把整张表拍平成一段文字
    expect(sharedStringsXml).not.toContain("区域销售额");
  });

  it("包裹层里的段落与表格按顺序导出", async () => {
    const blob = await createStandardXlsxBlob(`
      <div class="demo-card">
        <p>下表为季度数据</p>
        <table><tr><td>Q1</td><td>100</td></tr></table>
        <p>数据来源：财务部</p>
      </div>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sheetXml = await archive
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");
    const strings = Array.from(
      sharedStringsXml.matchAll(/<si>(.*?)<\/si>/gs),
      (match) => match[1],
    );
    const cellOf = (text: string) => {
      const index = strings.findIndex((item) => item.includes(text));
      expect(index).toBeGreaterThan(-1);
      return sheetXml.match(
        new RegExp(`<c r="([A-Z]+\\d+)"[^>]*t="s"[^>]*><v>${index}</v>`),
      )?.[1];
    };

    expect(cellOf("下表为季度数据")).toBe("A1");
    expect(sheetXml).toMatch(/<c r="B2"[^>]*><v>100<\/v><\/c>/);
    expect(cellOf("数据来源：财务部")).toBe("A4");
  });

  it("松散列表项里的嵌套段落保留列表前缀", async () => {
    const blob = await createStandardXlsxBlob(`
      <ul><li><p>第一项</p></li></ul>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");

    expect(sharedStringsXml).toContain("• 第一项");
  });

  it("demo 内联 style 既不写入正文，也不影响表格配色", async () => {
    const blob = await createStandardXlsxBlob(`
      <style>.demo-card table td { background-color: #e6f4ff; color: #0958d9; }</style>
      <div class="demo-card">
        <table><tr><td>华东</td><td>120</td></tr></table>
      </div>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");
    const stylesXml = await archive.file("xl/styles.xml")!.async("string");

    expect(sharedStringsXml).not.toContain("background-color");
    expect(stylesXml).not.toContain('rgb="FFE6F4FF"');
    expect(stylesXml).not.toContain('rgb="FF0958D9"');
    expect(stylesXml).not.toContain('<patternFill patternType="solid">');
    expect(sharedStringsXml).toContain("华东");
  });

  it("代码块只导出代码内容，不带工具栏文案", async () => {
    const blob = await createStandardXlsxBlob(`
      <markdown-code-block class="markdown-code-block">
        <div class="markdown-code-toolbar">
          <span class="markdown-code-language">javascript</span>
          <div class="markdown-code-actions"><button aria-label="复制代码"></button></div>
        </div>
        <pre><code>const a = 1;</code></pre>
      </markdown-code-block>
    `);
    const archive = await JSZip.loadAsync(await blob.arrayBuffer());
    const sharedStringsXml = await archive
      .file("xl/sharedStrings.xml")!
      .async("string");

    expect(sharedStringsXml).toContain("const a = 1;");
    expect(sharedStringsXml).not.toMatch(/<t>javascript<\/t>/);
  });
});
