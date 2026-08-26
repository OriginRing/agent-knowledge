// @vitest-environment happy-dom

import { describe, expect, it } from "vitest";

import { repairScrollableSnapshot, type ScrollLayout } from "./glass-snapshot";

describe("repairScrollableSnapshot", () => {
  it("恢复滚动截图中对话列表的 flex 布局", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" data-glass-scroll-capture="0" style="display:flex"><div style="transform:translate(0px, -120px);will-change: transform;display:inline-block;width:100%"><span>消息</span></div></div></foreignObject></svg>`;
    const layout: ScrollLayout = {
      alignContent: "normal",
      alignItems: "normal",
      columnGap: "normal",
      display: "flex",
      flexDirection: "column",
      flexWrap: "nowrap",
      gridAutoColumns: "auto",
      gridAutoFlow: "row",
      gridAutoRows: "auto",
      gridTemplateColumns: "none",
      gridTemplateRows: "none",
      id: "0",
      justifyContent: "normal",
      minHeight: 100,
      rowGap: "16px",
      scrollLeft: 0,
      scrollTop: 120,
    };

    const repaired = repairScrollableSnapshot(
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
      [layout],
    );
    const output = decodeURIComponent(
      repaired.slice(repaired.indexOf(",") + 1),
    );
    const document = new DOMParser().parseFromString(output, "image/svg+xml");
    const list = document.querySelector("div")!;
    const wrapper = list.firstElementChild!;

    expect(list.getAttribute("data-glass-scroll-capture")).toBeNull();
    expect(list.getAttribute("style")).toContain("display:block!important");
    expect(wrapper.getAttribute("style")).toContain("display:flex!important");
    expect(wrapper.getAttribute("style")).toContain("flex-direction:column");
    expect(wrapper.getAttribute("style")).toContain("row-gap:16px");
    expect(wrapper.getAttribute("style")).toContain("min-height:100px");
  });
});
