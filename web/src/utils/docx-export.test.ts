// @vitest-environment happy-dom

import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import {
  createStandardDocxBlob,
  type StandardDocxOptions,
} from "./docx-export";

async function documentFiles(html: string, options?: StandardDocxOptions) {
  const blob = await createStandardDocxBlob(html, options);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("word/document.xml")?.async("string");
  const styles = await zip.file("word/styles.xml")?.async("string");
  return { xml, styles, zip };
}

describe("标准 DOCX 导出", () => {
  it("将正文写入 WordprocessingML 而不是 altChunk", async () => {
    const { xml, zip } = await documentFiles(
      "<h2>销售报告</h2><p>本月销售额<strong>持续增长</strong></p>",
    );

    expect(xml).toContain("销售报告");
    expect(xml).toContain("本月销售额");
    expect(xml).toContain("持续增长");
    expect(xml).toContain("<w:t");
    expect(xml).not.toContain("altChunk");
    expect(zip.file("word/afchunk.mht")).toBeNull();
  });

  it("生成原生列表和表格", async () => {
    const { xml } = await documentFiles(`
      <ol><li>第一项</li><li>第二项</li></ol>
      <table><tr><th>姓名</th><th>金额</th></tr><tr><td>小王</td><td>100</td></tr></table>
    `);

    expect(xml).toContain("第一项");
    expect(xml).toContain("第二项");
    expect(xml).toContain("<w:tbl>");
    expect(xml).toContain("姓名");
    expect(xml).toContain("100");
  });

  it("将 PNG 写入 Word 媒体目录", async () => {
    const { xml, zip } = await documentFiles(
      '<p>图表</p><img alt="销售图表" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=">',
    );

    expect(xml).toContain("<w:drawing>");
    expect(
      Object.keys(zip.files).some((path) => path.startsWith("word/media/")),
    ).toBe(true);
  });

  it("应用仿宋正文、黑体标题和截图中的段落尺寸", async () => {
    const { xml, styles } = await documentFiles(
      "<h1>报告标题</h1><p>正文内容</p>",
    );

    expect(styles).toContain('w:eastAsia="仿宋_GB2312"');
    expect(styles).toContain('w:eastAsia="黑体"');
    expect(styles).toContain('w:sz w:val="44"');
    expect(xml).toContain('w:jc w:val="center"');
    expect(xml).toContain('w:firstLine="560"');
    expect(xml).toContain('w:after="240"');
    expect(xml).toContain('w:line="560"');
    expect(xml).toContain('w:lineRule="exact"');
  });

  it("isLinkBreak 只控制表头是否禁止换行", async () => {
    const html =
      "<table><tr><th>很长的表头</th></tr><tr><td>正文</td></tr></table>";
    const wrapping = await documentFiles(html, { isLinkBreak: true });
    const noWrapping = await documentFiles(html, { isLinkBreak: false });

    expect(wrapping.xml).not.toContain("<w:noWrap/>");
    expect(noWrapping.xml).toContain("<w:noWrap/>");
    expect(noWrapping.xml?.match(/<w:noWrap\/>/g)).toHaveLength(1);
    expect(noWrapping.xml).toContain("<w:noWrap/><w:tcMar>");
  });
});
