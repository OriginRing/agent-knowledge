// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";
import { searchTable } from "./table-search";

describe("表格全文搜索", () => {
  it("匹配所有单元格且忽略英文大小写，按字面处理特殊字符", () => {
    const html =
      "<table><tr><th>Alpha</th><td>alpha ALPHA</td><td>[a]+</td></tr></table>";
    expect(searchTable(html, "alpha").count).toBe(3);
    expect(searchTable(html, "[a]+").count).toBe(1);
    expect(searchTable(html, "不存在").count).toBe(0);
    expect(searchTable(html, "")).toEqual({ html, count: 0 });
  });

  it("跨行内标签查找，保留链接、格式与相同匹配序号", () => {
    const html =
      '<table><tr><td>无线<strong>鼠标</strong>与<a href="/item">无线鼠标</a></td></tr></table>';
    const result = searchTable(html, "无线鼠标");
    const container = document.createElement("div");
    container.innerHTML = result.html;
    expect(result.count).toBe(2);
    expect(container.querySelectorAll('[data-table-match="0"]')).toHaveLength(
      2,
    );
    expect(container.querySelectorAll('[data-table-match="1"]')).toHaveLength(
      1,
    );
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/item");
    expect(container.querySelector("strong")?.textContent).toBe("鼠标");
    expect(container.textContent).toBe("无线鼠标与无线鼠标");
  });

  it("嵌套表格的文字计数一次，忽略脚本和样式", () => {
    const html =
      "<table><tr><td>鼠标<style>.鼠标 {}</style><table><tr><td>鼠标</td></tr></table></td></tr></table>";
    expect(searchTable(html, "鼠标").count).toBe(2);
  });
});
