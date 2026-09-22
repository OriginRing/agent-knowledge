import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  LineRuleType,
  PageOrientation,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  XmlComponent,
  type FileChild,
  type ITableCellOptions,
  type ParagraphChild,
} from "docx";

const MAX_IMAGE_WIDTH = 620;
const DEFAULT_IMAGE_HEIGHT = 348;
const ORDERED_LIST_REFERENCE = "ordered-list";
const BODY_FONT = {
  ascii: "FangSong_GB2312",
  hAnsi: "FangSong_GB2312",
  eastAsia: "仿宋_GB2312",
  cs: "FangSong_GB2312",
};
const HEADING_FONT = {
  ascii: "SimHei",
  hAnsi: "SimHei",
  eastAsia: "黑体",
  cs: "SimHei",
};
const TABLE_BORDER = {
  style: BorderStyle.SINGLE,
  size: 6,
  color: "000000",
};

export interface StandardDocxOptions {
  isLinkBreak?: boolean;
}

interface ConversionContext {
  inTableCell?: boolean;
  isLinkBreak: boolean;
  textStyle?: TextStyle;
}

interface TextStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  backgroundColor?: string;
  font?: string;
}

class TableCellNoWrap extends XmlComponent {
  constructor() {
    super("w:noWrap");
  }
}

class StyledTableCell extends TableCell {
  constructor(options: ITableCellOptions, noWrap: boolean) {
    super(options);
    if (noWrap) {
      const properties = this.root[0] as XmlComponent;
      const propertiesChildren = (
        properties as unknown as {
          root: unknown[];
        }
      ).root;
      const insertBeforeIndex = propertiesChildren.findIndex((child) =>
        ["w:tcMar", "w:textDirection", "w:vAlign"].includes(
          (child as { rootKey?: string }).rootKey || "",
        ),
      );
      propertiesChildren.splice(
        insertBeforeIndex < 0 ? propertiesChildren.length : insertBeforeIndex,
        0,
        new TableCellNoWrap(),
      );
    }
  }
}

function normalizeColor(value: string) {
  const normalizedValue = value.trim();
  if (
    !normalizedValue ||
    normalizedValue === "transparent" ||
    /^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/i.test(normalizedValue)
  ) {
    return undefined;
  }

  const hex = normalizedValue.match(/^#([\da-f]{6})$/i);
  if (hex) return hex[1].toUpperCase();

  const rgb = normalizedValue.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!rgb) return undefined;
  return rgb
    .slice(1, 4)
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function mergeTextStyle(style: TextStyle, element: HTMLElement): TextStyle {
  const tag = element.tagName.toLowerCase();
  const fontWeight = element.style.fontWeight;
  const textDecoration = element.style.textDecoration;
  return {
    ...style,
    bold:
      style.bold ||
      tag === "strong" ||
      tag === "b" ||
      fontWeight === "bold" ||
      Number(fontWeight) >= 600,
    italics:
      style.italics ||
      tag === "em" ||
      tag === "i" ||
      element.style.fontStyle === "italic",
    underline:
      style.underline || tag === "u" || textDecoration.includes("underline"),
    strike:
      style.strike ||
      tag === "s" ||
      tag === "del" ||
      textDecoration.includes("line-through"),
    color: normalizeColor(element.style.color) || style.color,
    backgroundColor:
      normalizeColor(element.style.backgroundColor) ||
      (tag === "mark" ? "FFFF00" : style.backgroundColor),
    font:
      tag === "code" || tag === "pre"
        ? "Consolas"
        : element.style.fontFamily || style.font,
  };
}

function textRun(text: string, style: TextStyle) {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    underline: style.underline ? {} : undefined,
    strike: style.strike,
    color: style.color,
    shading: style.backgroundColor
      ? {
          type: ShadingType.CLEAR,
          fill: style.backgroundColor,
          color: "auto",
        }
      : undefined,
    font: style.font,
  });
}

function dataUrlToBytes(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(",");
  if (commaIndex < 0) throw new Error("图片 Data URL 无效");
  const metadata = dataUrl.slice(0, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);
  if (!metadata.includes(";base64")) {
    return new TextEncoder().encode(decodeURIComponent(data));
  }
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function imageType(contentType: string, source: string) {
  const value = `${contentType} ${source}`.toLowerCase();
  if (value.includes("png")) return "png" as const;
  if (value.includes("gif")) return "gif" as const;
  if (value.includes("bmp")) return "bmp" as const;
  if (value.includes("jpeg") || value.includes("jpg")) return "jpg" as const;
  throw new Error(`不支持的图片格式: ${contentType || source}`);
}

function jpegSize(data: Uint8Array) {
  let offset = 2;
  while (offset + 8 < data.length) {
    if (data[offset] !== 0xff) break;
    const marker = data[offset + 1];
    const length = (data[offset + 2] << 8) + data[offset + 3];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9].includes(marker)) {
      return {
        width: (data[offset + 7] << 8) + data[offset + 8],
        height: (data[offset + 5] << 8) + data[offset + 6],
      };
    }
    if (length < 2) break;
    offset += length + 2;
  }
  return undefined;
}

function imageDimensions(
  data: Uint8Array,
  type: "png" | "gif" | "bmp" | "jpg",
) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (type === "png" && data.length >= 24) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (type === "gif" && data.length >= 10) {
    return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
  }
  if (type === "bmp" && data.length >= 26) {
    return {
      width: view.getUint32(18, true),
      height: Math.abs(view.getInt32(22, true)),
    };
  }
  if (type === "jpg") return jpegSize(data);
  return undefined;
}

function imageSize(
  data: Uint8Array,
  type: "png" | "gif" | "bmp" | "jpg",
  fallbackWidth: number,
) {
  const dimensions = imageDimensions(data, type);
  if (!dimensions?.width || !dimensions.height) {
    return { width: fallbackWidth, height: DEFAULT_IMAGE_HEIGHT };
  }
  const width = Math.min(dimensions.width, fallbackWidth, MAX_IMAGE_WIDTH);
  return {
    width,
    height: Math.max(
      1,
      Math.round((dimensions.height * width) / dimensions.width),
    ),
  };
}

async function imageRun(element: HTMLImageElement) {
  const source = element.src || element.getAttribute("src") || "";
  if (!source) throw new Error("图片缺少 src");

  let data: Uint8Array;
  let contentType = source.match(/^data:([^;,]+)/i)?.[1] || "";
  if (source.startsWith("data:")) {
    data = dataUrlToBytes(source);
  } else {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`图片下载失败: ${response.status}`);
    contentType = response.headers.get("content-type") || "";
    data = new Uint8Array(await response.arrayBuffer());
  }

  const type = imageType(contentType, source);
  const requestedWidth = Math.min(
    Number(element.getAttribute("width")) || MAX_IMAGE_WIDTH,
    MAX_IMAGE_WIDTH,
  );
  const size = imageSize(data, type, requestedWidth);
  return new ImageRun({
    type,
    data,
    transformation: size,
    altText: {
      name: element.alt || "图片",
      description: element.alt || "图片",
    },
  });
}

async function inlineChildren(
  node: Node,
  inheritedStyle: TextStyle = {},
  preserveWhitespace = false,
): Promise<ParagraphChild[]> {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || "";
    if (!preserveWhitespace) {
      const normalizedText = text.replace(/\s+/g, " ");
      return normalizedText ? [textRun(normalizedText, inheritedStyle)] : [];
    }

    return text.split(/\r\n?|\n/).flatMap((line, index, lines) => {
      const runs: ParagraphChild[] = [];
      if (line) runs.push(textRun(line, inheritedStyle));
      if (index < lines.length - 1) runs.push(new TextRun({ break: 1 }));
      return runs;
    });
  }
  if (!(node instanceof HTMLElement)) return [];

  const tag = node.tagName.toLowerCase();
  if (tag === "br") return [new TextRun({ break: 1 })];
  if (tag === "img") {
    try {
      return [await imageRun(node as HTMLImageElement)];
    } catch (error) {
      console.error("图片导出失败:", error);
      return [
        textRun(`[图片导出失败：${node.getAttribute("alt") || "图片"}]`, {}),
      ];
    }
  }

  const style = mergeTextStyle(inheritedStyle, node);
  const shouldPreserveWhitespace = preserveWhitespace || tag === "pre";
  const children = (
    await Promise.all(
      Array.from(node.childNodes).map((child) =>
        inlineChildren(child, style, shouldPreserveWhitespace),
      ),
    )
  ).flat();
  if (tag === "a" && node.getAttribute("href")) {
    return [
      new ExternalHyperlink({
        link: node.getAttribute("href") || "",
        children,
      }),
    ];
  }
  return children;
}

function paragraphAlignment(element: HTMLElement) {
  const alignment = element.style.textAlign;
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right") return AlignmentType.RIGHT;
  if (alignment === "justify") return AlignmentType.JUSTIFIED;
  return undefined;
}

async function paragraphFromElement(
  element: HTMLElement,
  options: {
    bulletLevel?: number;
    orderedLevel?: number;
    context?: ConversionContext;
  } = {},
) {
  const tag = element.tagName.toLowerCase();
  const context = options.context;
  const isHeadingOne = tag === "h1";
  const isPageNumber = element.classList.contains("page-number");
  const heading =
    tag === "h1"
      ? HeadingLevel.HEADING_1
      : tag === "h2"
        ? HeadingLevel.HEADING_2
        : tag === "h3"
          ? HeadingLevel.HEADING_3
          : tag === "h4"
            ? HeadingLevel.HEADING_4
            : tag === "h5"
              ? HeadingLevel.HEADING_5
              : tag === "h6"
                ? HeadingLevel.HEADING_6
                : undefined;
  const inlineNodes = Array.from(element.childNodes).filter(
    (child) =>
      !(child instanceof HTMLElement) ||
      !["ul", "ol", "table"].includes(child.tagName.toLowerCase()),
  );
  const children = (
    await Promise.all(
      inlineNodes.map((node) =>
        inlineChildren(node, context?.textStyle, tag === "pre"),
      ),
    )
  ).flat();

  return new Paragraph({
    children,
    heading,
    alignment: isHeadingOne
      ? AlignmentType.CENTER
      : isPageNumber || context?.inTableCell
        ? AlignmentType.CENTER
        : paragraphAlignment(element) || AlignmentType.LEFT,
    bullet:
      options.bulletLevel === undefined
        ? undefined
        : { level: options.bulletLevel },
    numbering:
      options.orderedLevel === undefined
        ? undefined
        : { reference: ORDERED_LIST_REFERENCE, level: options.orderedLevel },
    indent:
      tag === "blockquote"
        ? { left: 720 }
        : tag === "p" && !context?.inTableCell
          ? { firstLine: 560 }
          : undefined,
    shading:
      tag === "pre" ? { type: ShadingType.CLEAR, fill: "F5F5F5" } : undefined,
    spacing: {
      before: isPageNumber ? 600 : undefined,
      after: isHeadingOne ? 400 : tag === "p" ? 240 : 0,
      line: 560,
      lineRule: LineRuleType.EXACT,
    },
    wordWrap: context?.inTableCell ? context.isLinkBreak : undefined,
  });
}

async function listChildren(
  list: HTMLElement,
  level = 0,
): Promise<FileChild[]> {
  const ordered = list.tagName.toLowerCase() === "ol";
  const output: FileChild[] = [];
  for (const item of Array.from(list.children)) {
    if (item.tagName.toLowerCase() !== "li") continue;
    output.push(
      await paragraphFromElement(item as HTMLElement, {
        bulletLevel: ordered ? undefined : Math.min(level, 8),
        orderedLevel: ordered ? Math.min(level, 8) : undefined,
      }),
    );
    for (const nested of Array.from(item.children)) {
      if (["ul", "ol"].includes(nested.tagName.toLowerCase())) {
        output.push(...(await listChildren(nested as HTMLElement, level + 1)));
      }
    }
  }
  return output;
}

async function tableFromElement(
  element: HTMLTableElement,
  context: ConversionContext,
) {
  const rows: TableRow[] = [];
  for (const [rowIndex, row] of Array.from(element.rows).entries()) {
    const cells = await Promise.all(
      Array.from(row.cells).map(async (cell) => {
        const isHeader = cell.tagName.toLowerCase() === "th";
        const children = await blockChildren(cell, {
          ...context,
          inTableCell: true,
          textStyle: isHeader ? { bold: true } : undefined,
        });
        return new StyledTableCell(
          {
            children: children.length ? children : [new Paragraph("")],
            columnSpan: cell.colSpan > 1 ? cell.colSpan : undefined,
            rowSpan: cell.rowSpan > 1 ? cell.rowSpan : undefined,
            verticalAlign: VerticalAlignTable.CENTER,
            margins: { top: 120, bottom: 120, left: 200, right: 200 },
          },
          isHeader && !context.isLinkBreak,
        );
      }),
    );
    rows.push(new TableRow({ children: cells, tableHeader: rowIndex === 0 }));
  }
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.AUTOFIT,
    borders: {
      top: TABLE_BORDER,
      right: TABLE_BORDER,
      bottom: TABLE_BORDER,
      left: TABLE_BORDER,
      insideHorizontal: TABLE_BORDER,
      insideVertical: TABLE_BORDER,
    },
  });
}

async function blockElement(
  element: HTMLElement,
  context: ConversionContext,
): Promise<FileChild[]> {
  const tag = element.tagName.toLowerCase();
  if (tag === "markdown-code-block") {
    const codeElement = element.querySelector("pre");
    return codeElement
      ? [await paragraphFromElement(codeElement, { context })]
      : blockChildren(element, context);
  }
  if (tag === "ul" || tag === "ol") return listChildren(element);
  if (tag === "table")
    return [await tableFromElement(element as HTMLTableElement, context)];
  if (
    ["div", "section", "article", "main"].includes(tag) &&
    !element.classList.contains("page-number")
  ) {
    return blockChildren(element, context);
  }
  return [await paragraphFromElement(element, { context })];
}

async function blockChildren(
  element: HTMLElement,
  context: ConversionContext,
): Promise<FileChild[]> {
  const output: FileChild[] = [];
  let inlineBuffer: Node[] = [];

  const flushInlineBuffer = async () => {
    if (!inlineBuffer.length) return;
    const wrapper = document.createElement("p");
    inlineBuffer.forEach((node) => wrapper.append(node.cloneNode(true)));
    output.push(await paragraphFromElement(wrapper, { context }));
    inlineBuffer = [];
  };

  for (const child of Array.from(element.childNodes)) {
    if (child instanceof HTMLElement) {
      const tag = child.tagName.toLowerCase();
      if (
        [
          "address",
          "article",
          "blockquote",
          "div",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "main",
          "markdown-code-block",
          "ol",
          "p",
          "pre",
          "section",
          "table",
          "ul",
        ].includes(tag)
      ) {
        await flushInlineBuffer();
        output.push(...(await blockElement(child, context)));
        continue;
      }
    }
    if (child.nodeType !== Node.TEXT_NODE || child.textContent?.trim()) {
      inlineBuffer.push(child);
    }
  }
  await flushInlineBuffer();
  return output;
}

export async function createStandardDocxBlob(
  html: string,
  { isLinkBreak = true }: StandardDocxOptions = {},
) {
  const container = document.createElement("div");
  container.innerHTML = html;
  const children = await blockChildren(container, { isLinkBreak });
  const file = new Document({
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT, size: 28, color: "000000" },
          paragraph: {
            spacing: { after: 240, line: 560, lineRule: LineRuleType.EXACT },
          },
        },
        heading1: {
          run: { font: HEADING_FONT, size: 44, bold: false, color: "000000" },
          paragraph: {
            alignment: AlignmentType.CENTER,
            spacing: {
              after: 400,
              line: 560,
              lineRule: LineRuleType.EXACT,
            },
          },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: ORDERED_LIST_REFERENCE,
          levels: Array.from({ length: 9 }, (_, level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            style: {
              paragraph: {
                indent: { left: 720 + level * 360, hanging: 360 },
              },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: "21cm",
              height: "29.7cm",
              orientation: PageOrientation.PORTRAIT,
            },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: children.length ? children : [new Paragraph("")],
      },
    ],
  });
  return Packer.toBlob(file);
}
