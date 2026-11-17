import {
  Workbook,
  type Border,
  type Cell,
  type CellRichTextValue,
  type Font,
  type Worksheet,
} from "exceljs";

const BASE_COLUMN_COUNT = 8;
const LANDSCAPE_PRINTABLE_WIDTH = 112;
const MAX_IMAGE_WIDTH = 900;
const MAX_TEXT_LENGTH_PER_ROW = 500;
const DEFAULT_FONT = "等线";
const DEFAULT_FONT_COLOR = "FF1F1F1F";
const DEFAULT_TABLE_FONT_SIZE = 11;
const DEFAULT_BORDER_COLOR = "FFBFBFBF";

type Horizontal = "left" | "center" | "right" | "justify";
type Vertical = "top" | "middle" | "bottom";

const TABLE_BORDER: Partial<Border> = {
  style: "thin",
  color: { argb: DEFAULT_BORDER_COLOR },
};

interface CellPlacement {
  column: number;
  columnSpan: number;
  rowSpan: number;
}

interface TableCellStyle {
  bold: boolean;
  horizontal: Horizontal;
  vertical: Vertical;
}

interface RunFont {
  bold: boolean;
}

interface RawRun {
  text: string;
  font: RunFont;
  isBreak?: boolean;
}

interface BuiltCellContent {
  value: string | number | CellRichTextValue;
  numFmt?: string;
  plainText: string;
}

interface RowContext {
  indent?: number;
  prefix?: string;
}

interface StyleProbe {
  /** 内联样式优先，其次取计算样式 */
  value(property: string): string;
  /** 仅内联样式 */
  inline(property: string): string;
}

function getText(element: Element) {
  return (element.textContent || "").replace(/\u00a0/g, " ").trim();
}

function parseCellValue(text: string) {
  const normalized = text.replace(/,/g, "");
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?%$/.test(normalized)) {
    return { value: Number(normalized.slice(0, -1)) / 100, numFmt: "0.00%" };
  }
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(normalized)) {
    return {
      value: Number(normalized),
      numFmt: normalized.includes(".") ? "#,##0.00" : "#,##0",
    };
  }
  return { value: text };
}

function parsePixelValue(raw: string) {
  if (!raw) return undefined;
  const match = raw.trim().match(/^(-?[\d.]+)(px)?$/i);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : undefined;
}

function mapHorizontal(value: string, fallback: Horizontal): Horizontal {
  switch (value.trim().toLowerCase()) {
    case "center":
    case "centercontinuous":
      return "center";
    case "right":
    case "end":
      return "right";
    case "justify":
      return "justify";
    case "left":
    case "start":
      return "left";
    default:
      return fallback;
  }
}

function mapVertical(value: string, fallback: Vertical): Vertical {
  switch (value.trim().toLowerCase()) {
    case "top":
    case "text-top":
      return "top";
    case "bottom":
    case "text-bottom":
      return "bottom";
    case "middle":
    case "center":
      return "middle";
    default:
      return fallback;
  }
}

function createProbe(element: HTMLElement): StyleProbe {
  const computed =
    element.isConnected &&
    typeof window !== "undefined" &&
    typeof window.getComputedStyle === "function"
      ? window.getComputedStyle(element)
      : undefined;
  const record = (value: unknown) =>
    typeof value === "string" ? value.trim() : "";
  const inline = (property: string) =>
    record((element.style as unknown as Record<string, unknown>)[property]);
  return {
    inline,
    value: (property: string) =>
      inline(property) ||
      (computed
        ? record((computed as unknown as Record<string, unknown>)[property])
        : ""),
  };
}

/**
 * 只取最基础的表格样式：表头加粗、水平/垂直对齐。
 * 背景色、字色、字号、斜体/下划线、自定义边框等一律不导出，保持干净统一的表格外观。
 */
function readCellStyle(cell: HTMLTableCellElement): TableCellStyle {
  const probe = createProbe(cell);
  const isHeader = cell.tagName === "TH";
  const weight = probe.value("fontWeight");
  return {
    bold:
      isHeader || /bold/i.test(weight) || Number.parseInt(weight, 10) >= 600,
    horizontal: mapHorizontal(
      probe.value("textAlign"),
      isHeader ? "center" : "left",
    ),
    vertical: mapVertical(probe.value("verticalAlign"), "middle"),
  };
}

function sameFont(a: RunFont, b: RunFont) {
  return a.bold === b.bold;
}

function collectRuns(
  node: Node,
  inherited: RunFont,
  runs: RawRun[],
  inBlock: boolean,
) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || "").replace(/\u00a0/g, " ");
    const normalized = text.replace(/\s+/g, " ");
    if (normalized) {
      runs.push({ text: normalized, font: inherited });
    } else if (text) {
      runs.push({ text: " ", font: inherited });
    }
    return;
  }
  if (!(node instanceof HTMLElement)) return;

  const tag = node.tagName.toLowerCase();
  if (tag === "br") {
    runs.push({ text: "\n", font: inherited, isBreak: true });
    return;
  }
  if (["script", "style"].includes(tag)) return;

  const probe = createProbe(node);
  const font: RunFont = {
    bold:
      inherited.bold ||
      ["strong", "b"].includes(tag) ||
      /bold/i.test(probe.value("fontWeight")) ||
      Number.parseInt(probe.value("fontWeight"), 10) >= 600,
  };
  const isBlock = [
    "div",
    "p",
    "li",
    "ul",
    "ol",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "blockquote",
    "pre",
  ].includes(tag);

  if (isBlock && !inBlock && runs.length) {
    runs.push({ text: "\n", font: inherited, isBreak: true });
  }
  Array.from(node.childNodes).forEach((child) =>
    collectRuns(child, font, runs, inBlock || isBlock),
  );
  if (isBlock) {
    runs.push({ text: "\n", font: inherited, isBreak: true });
  }
}

function trimRuns(runs: RawRun[]) {
  const output = [...runs];
  while (output.length) {
    const first = output[0];
    if (first.isBreak) {
      output.shift();
      continue;
    }
    const trimmed = first.text.trimStart();
    if (!trimmed) {
      output.shift();
      continue;
    }
    output[0] = { ...first, text: trimmed };
    break;
  }
  while (output.length) {
    const last = output[output.length - 1];
    if (last.isBreak) {
      output.pop();
      continue;
    }
    const trimmed = last.text.trimEnd();
    if (!trimmed) {
      output.pop();
      continue;
    }
    output[output.length - 1] = { ...last, text: trimmed };
    break;
  }
  return output;
}

function normalizeRuns(runs: RawRun[]) {
  const merged: RawRun[] = [];
  runs.forEach((run) => {
    if (!run.text) return;
    const last = merged[merged.length - 1];
    if (
      last &&
      !last.isBreak &&
      !run.isBreak &&
      sameFont(last.font, run.font)
    ) {
      last.text += run.text;
      return;
    }
    merged.push({ ...run });
  });
  return trimRuns(merged);
}

function toExcelFont(font: RunFont): Partial<Font> {
  return {
    name: DEFAULT_FONT,
    size: DEFAULT_TABLE_FONT_SIZE,
    bold: font.bold || undefined,
    color: { argb: DEFAULT_FONT_COLOR },
  };
}

function buildCellContent(
  cell: HTMLTableCellElement,
  style: TableCellStyle,
): BuiltCellContent {
  const baseFont: RunFont = { bold: style.bold };
  const runs: RawRun[] = [];
  Array.from(cell.childNodes).forEach((node) =>
    collectRuns(node, baseFont, runs, false),
  );
  const normalized = normalizeRuns(runs);
  const plainText = normalized
    .map((run) => run.text)
    .join("")
    .trim();
  if (!plainText) return { value: "", plainText: "" };

  if (normalized.every((run) => sameFont(run.font, baseFont))) {
    const parsed = parseCellValue(plainText);
    return { ...parsed, plainText };
  }

  return {
    value: {
      richText: normalized.map((run) => ({
        text: run.text,
        font: toExcelFont(run.font),
      })),
    },
    plainText,
  };
}

function applyCellStyle(cell: Cell, style: TableCellStyle) {
  cell.font = {
    name: DEFAULT_FONT,
    size: DEFAULT_TABLE_FONT_SIZE,
    bold: style.bold,
    color: { argb: DEFAULT_FONT_COLOR },
  };
  cell.alignment = {
    horizontal: style.horizontal,
    vertical: style.vertical,
    wrapText: true,
  };
}

function applyTableBorder(cell: Cell) {
  cell.border = {
    top: TABLE_BORDER,
    left: TABLE_BORDER,
    bottom: TABLE_BORDER,
    right: TABLE_BORDER,
  };
}

function splitText(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const chunks: string[] = [];

  lines.forEach((line) => {
    let rest = line;
    while (rest.length > MAX_TEXT_LENGTH_PER_ROW) {
      const candidates = [
        rest.lastIndexOf("。", MAX_TEXT_LENGTH_PER_ROW),
        rest.lastIndexOf("；", MAX_TEXT_LENGTH_PER_ROW),
        rest.lastIndexOf(" ", MAX_TEXT_LENGTH_PER_ROW),
      ];
      const candidate = Math.max(...candidates);
      const breakpoint =
        candidate >= MAX_TEXT_LENGTH_PER_ROW * 0.6
          ? candidate
          : MAX_TEXT_LENGTH_PER_ROW - 1;
      chunks.push(rest.slice(0, breakpoint + 1).trim());
      rest = rest.slice(breakpoint + 1).trim();
    }
    if (rest) chunks.push(rest);
  });

  return chunks;
}

function estimateRowHeight(text: string) {
  const lineCount = Math.max(1, Math.ceil(text.length / 44));
  return Math.min(300, Math.max(24, lineCount * 22));
}

function addTextRow(
  worksheet: Worksheet,
  text: string,
  columnCount: number,
  options: {
    bold?: boolean;
    fontSize?: number;
    indent?: number;
    horizontal?: "left" | "center";
  } = {},
) {
  splitText(text).forEach((chunk) => {
    const row = worksheet.addRow([chunk]);
    worksheet.mergeCells(row.number, 1, row.number, columnCount);
    row.height = estimateRowHeight(chunk);
    const cell = row.getCell(1);
    cell.font = {
      name: DEFAULT_FONT,
      size: options.fontSize || 12,
      bold: options.bold,
      color: { argb: DEFAULT_FONT_COLOR },
    };
    cell.alignment = {
      vertical: "top",
      horizontal: options.horizontal || "left",
      wrapText: true,
      indent: options.indent || 0,
    };
  });
}

function getTableColumnCount(table: HTMLTableElement) {
  return Array.from(table.rows).reduce((maximum, row) => {
    const count = Array.from(row.cells).reduce(
      (total, cell) => total + Math.max(cell.colSpan || 1, 1),
      0,
    );
    return Math.max(maximum, count);
  }, 0);
}

function getColumnCount(container: HTMLElement) {
  const tableColumnCount = Array.from(
    container.querySelectorAll<HTMLTableElement>("table"),
  ).reduce(
    (maximum, table) => Math.max(maximum, getTableColumnCount(table)),
    0,
  );
  return Math.max(BASE_COLUMN_COUNT, tableColumnCount);
}

function nextAvailableColumn(
  occupied: Set<string>,
  rowNumber: number,
  startColumn: number,
) {
  let column = startColumn;
  while (occupied.has(`${rowNumber}:${column}`)) column += 1;
  return column;
}

function placeTableCell(
  occupied: Set<string>,
  rowNumber: number,
  startColumn: number,
  cell: HTMLTableCellElement,
): CellPlacement {
  const column = nextAvailableColumn(occupied, rowNumber, startColumn);
  const columnSpan = Math.max(cell.colSpan || 1, 1);
  const rowSpan = Math.max(cell.rowSpan || 1, 1);

  for (let row = rowNumber; row < rowNumber + rowSpan; row += 1) {
    for (let col = column; col < column + columnSpan; col += 1) {
      occupied.add(`${row}:${col}`);
    }
  }
  return { column, columnSpan, rowSpan };
}

function estimateTableCellHeight(text: string, columnSpan: number) {
  const charsPerLine = Math.max(6, 12 * columnSpan);
  const lineCount = text
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0,
    );
  return Math.min(300, Math.max(24, lineCount * 18));
}

function addTable(
  worksheet: Worksheet,
  table: HTMLTableElement,
  columnCount: number,
) {
  const caption = table.querySelector("caption");
  if (caption) {
    const captionText = getText(caption);
    if (captionText) {
      addTextRow(worksheet, captionText, columnCount, {
        bold: true,
        horizontal: "center",
      });
    }
  }

  const occupied = new Set<string>();
  const startRow = worksheet.rowCount + 1;

  Array.from(table.rows).forEach((sourceRow, rowOffset) => {
    const rowNumber = startRow + rowOffset;
    const row = worksheet.getRow(rowNumber);
    let rowHeight = 0;
    let nextColumn = 1;

    Array.from(sourceRow.cells).forEach((sourceCell) => {
      const placement = placeTableCell(
        occupied,
        rowNumber,
        nextColumn,
        sourceCell,
      );
      const endColumn = Math.min(
        placement.column + placement.columnSpan - 1,
        columnCount,
      );
      const endRow = rowNumber + placement.rowSpan - 1;
      if (endColumn > placement.column || endRow > rowNumber) {
        worksheet.mergeCells(rowNumber, placement.column, endRow, endColumn);
      }

      const style = readCellStyle(sourceCell);
      const content = buildCellContent(sourceCell, style);
      const cell = worksheet.getCell(rowNumber, placement.column);
      if (content.numFmt) cell.numFmt = content.numFmt;
      cell.value = content.value;

      for (let rowIndex = rowNumber; rowIndex <= endRow; rowIndex += 1) {
        for (let col = placement.column; col <= endColumn; col += 1) {
          const target = worksheet.getCell(rowIndex, col);
          applyCellStyle(target, style);
          applyTableBorder(target);
        }
      }

      rowHeight = Math.max(
        rowHeight,
        estimateTableCellHeight(content.plainText, placement.columnSpan),
      );
      nextColumn = endColumn + 1;
    });

    const explicitHeight = parsePixelValue(
      createProbe(sourceRow).inline("height"),
    );
    const minimumHeight = explicitHeight ? explicitHeight * 0.75 : 0;
    row.height = Math.round(
      Math.min(300, Math.max(24, rowHeight, minimumHeight)),
    );
  });
}

function imageExtension(source: string): "png" | "jpeg" | "gif" | null {
  const match = source.match(/^data:image\/(png|jpe?g|gif);base64,/i);
  if (!match) return null;
  return match[1].toLowerCase() === "jpg"
    ? "jpeg"
    : (match[1].toLowerCase() as "png" | "jpeg" | "gif");
}

async function sourceToDataUrl(source: string) {
  if (source.startsWith("data:image/")) return source;
  const response = await fetch(source);
  if (!response.ok) throw new Error(`图片下载失败: ${response.status}`);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(blob);
  });
}

async function getImageSize(source: string) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth || 620,
        height: image.naturalHeight || 348,
      });
    image.onerror = () => resolve({ width: 620, height: 348 });
    image.src = source;
  });
}

async function addImage(
  workbook: Workbook,
  worksheet: Worksheet,
  imageElement: HTMLImageElement,
  columnCount: number,
) {
  try {
    const source = await sourceToDataUrl(imageElement.src);
    const extension = imageExtension(source);
    if (!extension) {
      console.error("XLSX 图片导出失败: 不支持的图片格式");
      addTextRow(
        worksheet,
        `[图片未能导出] ${imageElement.alt || ""}`.trim(),
        columnCount,
      );
      return;
    }

    const originalSize = await getImageSize(source);
    const scale = Math.min(
      1,
      MAX_IMAGE_WIDTH / (originalSize.width || MAX_IMAGE_WIDTH),
      520 / (originalSize.height || 348),
    );
    const width = Math.max(
      1,
      Math.round((originalSize.width || MAX_IMAGE_WIDTH) * scale),
    );
    const height = Math.max(
      1,
      Math.round((originalSize.height || 348) * scale),
    );
    const row = worksheet.addRow([]);
    row.height = Math.min(409, height * 0.75 + 8);
    worksheet.mergeCells(row.number, 1, row.number, columnCount);
    const imageId = workbook.addImage({ base64: source, extension });
    worksheet.addImage(imageId, {
      tl: { col: 0, row: row.number - 1 },
      ext: { width, height },
      editAs: "oneCell",
    });
  } catch (error) {
    console.error("XLSX 图片导出失败:", error);
    addTextRow(
      worksheet,
      `[图片未能导出] ${imageElement.alt || ""}`.trim(),
      columnCount,
    );
  }
}

function listItemPrefix(element: Element) {
  if (element.parentElement?.tagName === "OL") {
    const index =
      Array.from(element.parentElement.children).indexOf(element) + 1;
    return `${index}. `;
  }
  return "• ";
}

const BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "blockquote",
  "dd",
  "details",
  "div",
  "dl",
  "dt",
  "figcaption",
  "figure",
  "footer",
  "form",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "header",
  "hr",
  "li",
  "main",
  "markdown-code-block",
  "nav",
  "ol",
  "p",
  "pre",
  "section",
  "summary",
  "table",
  "ul",
]);

function hasNestedBlock(element: Element) {
  return Array.from(element.children).some((child) =>
    BLOCK_TAGS.has(child.tagName.toLowerCase()),
  );
}

/** 只取元素自身的行内文本，跳过表格、列表等块级子节点，避免把嵌套内容拍平成一整段 */
function inlineText(element: Element): string {
  const parts: string[] = [];
  Array.from(element.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent || "");
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (BLOCK_TAGS.has(node.tagName.toLowerCase())) return;
    parts.push(inlineText(node));
  });
  return parts
    .join("")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addBasicTextRow(
  worksheet: Worksheet,
  element: Element,
  text: string,
  columnCount: number,
  context: RowContext = {},
) {
  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    const level = Number(tagName.slice(1));
    addTextRow(worksheet, text, columnCount, {
      bold: true,
      fontSize: Math.max(14, 22 - level * 2),
      horizontal: level === 1 ? "center" : "left",
    });
    return;
  }
  if (tagName === "li") {
    addTextRow(worksheet, `${listItemPrefix(element)}${text}`, columnCount, {
      indent: 1,
    });
    return;
  }
  if (tagName === "blockquote") {
    addTextRow(worksheet, text, columnCount, { indent: 1 });
    return;
  }
  addTextRow(worksheet, `${context.prefix ?? ""}${text}`, columnCount, {
    indent: context.indent ?? 0,
  });
}

async function appendElement(
  workbook: Workbook,
  worksheet: Worksheet,
  element: Element,
  columnCount: number,
  context: RowContext = {},
) {
  const tagName = element.tagName.toLowerCase();

  if (tagName === "table") {
    addTable(worksheet, element as HTMLTableElement, columnCount);
    worksheet.addRow([]).height = 8;
    return;
  }
  if (tagName === "img") {
    await addImage(
      workbook,
      worksheet,
      element as HTMLImageElement,
      columnCount,
    );
    return;
  }
  if (tagName === "ul" || tagName === "ol") {
    for (const child of Array.from(element.children)) {
      await appendElement(workbook, worksheet, child, columnCount);
    }
    return;
  }
  if (tagName === "hr") {
    worksheet.addRow([]).height = 6;
    return;
  }
  if (
    ["style", "script", "link", "meta", "template", "noscript"].includes(
      tagName,
    )
  ) {
    return;
  }
  if (tagName === "markdown-code-block") {
    const code = element.querySelector("pre");
    const codeText = code ? getText(code) : "";
    if (codeText) {
      addBasicTextRow(worksheet, element, codeText, columnCount, context);
      return;
    }
  }

  // 包裹层（div/section/li 里套表格、图片、列表等）：先输出自身行内文字，再逐个递归处理块级子节点
  if (hasNestedBlock(element)) {
    const ownText = inlineText(element);
    if (ownText) {
      addBasicTextRow(worksheet, element, ownText, columnCount, context);
    }
    const nestedContext: RowContext = {
      indent: Math.max(
        context.indent ?? 0,
        tagName === "li" || tagName === "blockquote" ? 1 : 0,
      ),
      prefix: tagName === "li" ? listItemPrefix(element) : undefined,
    };
    for (const child of Array.from(element.children)) {
      if (!BLOCK_TAGS.has(child.tagName.toLowerCase())) continue;
      await appendElement(
        workbook,
        worksheet,
        child,
        columnCount,
        nestedContext,
      );
    }
    return;
  }

  const text = getText(element);
  if (text) {
    addBasicTextRow(worksheet, element, text, columnCount, context);
  }
}

async function buildXlsxBlob(container: HTMLDivElement) {
  const columnCount = getColumnCount(container);
  const workbook = new Workbook();
  workbook.creator = "Agent Knowledge";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("回答", {
    properties: { defaultRowHeight: 24 },
    pageSetup: {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      pageOrder: "downThenOver",
      horizontalCentered: true,
      verticalCentered: false,
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.2,
        footer: 0.2,
      },
    },
    views: [{ state: "normal", showGridLines: false }],
  });

  const columnWidth = Math.max(
    5,
    Math.min(14, LANDSCAPE_PRINTABLE_WIDTH / columnCount),
  );
  worksheet.columns = Array.from({ length: columnCount }, () => ({
    width: columnWidth,
  }));

  for (const child of Array.from(container.children)) {
    await appendElement(workbook, worksheet, child, columnCount);
  }
  while (worksheet.lastRow && !worksheet.lastRow.hasValues) {
    worksheet.spliceRows(worksheet.lastRow.number, 1);
  }
  if (worksheet.rowCount === 0) worksheet.addRow([]);

  worksheet.pageSetup.printArea = `A1:${worksheet.getColumn(columnCount).letter}${Math.max(worksheet.rowCount, 1)}`;
  const writeBuffer = workbook.xlsx.writeBuffer.bind(
    workbook.xlsx,
  ) as () => Promise<ArrayBuffer>;
  const buffer = await writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/**
 * 导出 xlsx。
 * 表格样式依赖实际渲染结果，因此转换期间会把内容挂载到视口外（带 markdown-body 上下文），
 * 让内联样式与行内/单元格的类样式都能被 getComputedStyle 解析出来。
 */
export async function createStandardXlsxBlob(html: string) {
  const container = document.createElement("div");
  container.className = "markdown-body";
  container.style.width = "720px";
  container.innerHTML = html;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;top:0;left:-10000px;width:720px;height:0;overflow:hidden;opacity:0;pointer-events:none;";
  host.appendChild(container);

  const canMount = typeof document !== "undefined" && Boolean(document.body);
  if (canMount) document.body.appendChild(host);

  try {
    return await buildXlsxBlob(container);
  } finally {
    if (canMount) host.remove();
  }
}
