import { snapdom } from "@zumer/snapdom";

export interface ScrollLayout {
  alignContent: string;
  alignItems: string;
  columnGap: string;
  display: string;
  flexDirection: string;
  flexWrap: string;
  gridAutoColumns: string;
  gridAutoFlow: string;
  gridAutoRows: string;
  gridTemplateColumns: string;
  gridTemplateRows: string;
  id: string;
  justifyContent: string;
  minHeight: number;
  rowGap: string;
  scrollLeft: number;
  scrollTop: number;
}

const markerAttribute = "data-glass-scroll-capture";

const markScrollableElements = (root: HTMLElement) => {
  const layouts: ScrollLayout[] = [];
  const restore: Array<{ element: HTMLElement; value: string | null }> = [];

  [root, ...root.querySelectorAll<HTMLElement>("*")].forEach((element) => {
    const style = window.getComputedStyle(element);
    const scrollable = /^(auto|scroll|overlay)$/;
    if (!scrollable.test(style.overflowX) && !scrollable.test(style.overflowY))
      return;

    const id = String(layouts.length);
    restore.push({ element, value: element.getAttribute(markerAttribute) });
    element.setAttribute(markerAttribute, id);
    layouts.push({
      alignContent: style.alignContent,
      alignItems: style.alignItems,
      columnGap: style.columnGap,
      display: style.display,
      flexDirection: style.flexDirection,
      flexWrap: style.flexWrap,
      gridAutoColumns: style.gridAutoColumns,
      gridAutoFlow: style.gridAutoFlow,
      gridAutoRows: style.gridAutoRows,
      gridTemplateColumns: style.gridTemplateColumns,
      gridTemplateRows: style.gridTemplateRows,
      id,
      justifyContent: style.justifyContent,
      minHeight: Math.max(
        0,
        element.clientHeight -
          (Number.parseFloat(style.paddingTop) || 0) -
          (Number.parseFloat(style.paddingBottom) || 0),
      ),
      rowGap: style.rowGap,
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
    });
  });

  return {
    layouts,
    restore() {
      restore.forEach(({ element, value }) => {
        if (value === null) element.removeAttribute(markerAttribute);
        else element.setAttribute(markerAttribute, value);
      });
    },
  };
};

const appendStyles = (element: Element, declarations: string[]) => {
  const current = element.getAttribute("style")?.trim() || "";
  element.setAttribute(
    "style",
    `${current}${current && !current.endsWith(";") ? ";" : ""}${declarations.join(";")};`,
  );
};

const decodeSvg = (url: string) => {
  const separator = url.indexOf(",");
  if (separator < 0) return null;
  const metadata = url.slice(0, separator);
  const payload = url.slice(separator + 1);
  if (metadata.includes(";base64")) {
    const bytes = Uint8Array.from(atob(payload), (character) =>
      character.charCodeAt(0),
    );
    return new TextDecoder().decode(bytes);
  }
  return decodeURIComponent(payload);
};

export const repairScrollableSnapshot = (
  rawSvgUrl: string,
  layouts: ScrollLayout[],
) => {
  if (!layouts.length) return rawSvgUrl;
  const svg = decodeSvg(rawSvgUrl);
  if (!svg) return rawSvgUrl;
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) return rawSvgUrl;

  layouts.forEach((layout) => {
    const node = document.querySelector(`[${markerAttribute}="${layout.id}"]`);
    if (!node) return;
    node.removeAttribute(markerAttribute);
    appendStyles(node, [
      "overflow:hidden!important",
      "scrollbar-width:none!important",
      "-ms-overflow-style:none!important",
    ]);

    if (!layout.scrollLeft && !layout.scrollTop) return;
    const wrapper = Array.from(node.children).find((child) =>
      /will-change\s*:\s*transform/.test(child.getAttribute("style") || ""),
    );
    if (!wrapper) return;

    // snapDOM 用普通 block 包裹滚动内容；这里恢复滚动容器原来的布局，
    // 否则 flex/grid 对话列表在滚动后的截图里会重新排版。
    appendStyles(node, ["display:block!important"]);
    appendStyles(wrapper, [
      `display:${layout.display}!important`,
      `flex-direction:${layout.flexDirection}`,
      `flex-wrap:${layout.flexWrap}`,
      `align-content:${layout.alignContent}`,
      `align-items:${layout.alignItems}`,
      `justify-content:${layout.justifyContent}`,
      `row-gap:${layout.rowGap}`,
      `column-gap:${layout.columnGap}`,
      `grid-template-columns:${layout.gridTemplateColumns}`,
      `grid-template-rows:${layout.gridTemplateRows}`,
      `grid-auto-columns:${layout.gridAutoColumns}`,
      `grid-auto-rows:${layout.gridAutoRows}`,
      `grid-auto-flow:${layout.gridAutoFlow}`,
      `min-height:${layout.minHeight}px`,
    ]);
  });

  const serialized = new XMLSerializer().serializeToString(
    document.documentElement,
  );
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
};

const rasterize = async (url: string, dpr: number) => {
  const image = new Image();
  image.loading = "eager";
  image.decoding = "sync";
  image.crossOrigin = "anonymous";
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(image.naturalWidth * dpr));
  canvas.height = Math.max(1, Math.ceil(image.naturalHeight * dpr));
  canvas.style.width = `${image.naturalWidth}px`;
  canvas.style.height = `${image.naturalHeight}px`;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建页面快照画布");
  context.scale(dpr, dpr);
  context.drawImage(image, 0, 0);
  return canvas;
};

export const captureGlassSnapshot = async (source: HTMLElement) => {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const scrollCapture = markScrollableElements(source);
  try {
    const result = await snapdom(source, {
      dpr,
      embedFonts: false,
      exclude: [".glass-magnifier"],
      excludeMode: "remove",
      fast: true,
    });
    return rasterize(
      repairScrollableSnapshot(result.toRaw(), scrollCapture.layouts),
      dpr,
    );
  } finally {
    scrollCapture.restore();
  }
};
