import { Workbook, type Worksheet } from "exceljs";

const BASE_COLUMN_COUNT = 8;
const LANDSCAPE_PRINTABLE_WIDTH = 112;
const MAX_IMAGE_WIDTH = 900;
const MAX_TEXT_LENGTH_PER_ROW = 500;
const DEFAULT_FONT = "等线";
const BORDER_COLOR = "FFBFBFBF";

interface CellPlacement {
  column: number;
  columnSpan: number;
  rowSpan: number;
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
      color: { argb: "FF1F1F1F" },
    };
    cell.alignment = {
      vertical: "top",
      horizontal: options.horizontal || "left",
      wrapText: true,
      indent: options.indent || 0,
    };
  });
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

function addTable(
  worksheet: Worksheet,
  table: HTMLTableElement,
  columnCount: number,
) {
  const occupied = new Set<string>();
  const startRow = worksheet.rowCount + 1;
  const tableColumnCount = getTableColumnCount(table);

  Array.from(table.rows).forEach((sourceRow, rowOffset) => {
    const rowNumber = startRow + rowOffset;
    const row = worksheet.getRow(rowNumber);
    let rowHeight = 30;
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

      const cell = worksheet.getCell(rowNumber, placement.column);
      const text = getText(sourceCell);
      const cellValue = parseCellValue(text);
      cell.value = cellValue.value;
      if (cellValue.numFmt) cell.numFmt = cellValue.numFmt;
      cell.font = {
        name: DEFAULT_FONT,
        size: 11,
        bold: sourceCell.tagName === "TH",
        color: { argb: "FF1F1F1F" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: sourceCell.tagName === "TH" ? "FFE8EFF7" : "FFFFFFFF",
        },
      };
      rowHeight = Math.max(
        rowHeight,
        Math.min(
          300,
          Math.ceil(text.length / (12 * placement.columnSpan)) * 18,
        ),
      );

      nextColumn = endColumn + 1;
    });
    row.height = rowHeight;
  });

  const endRow = startRow + Math.max(table.rows.length - 1, 0);
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = 1; column <= tableColumnCount; column += 1) {
      worksheet.getCell(row, column).border = {
        top: { style: "thin", color: { argb: BORDER_COLOR } },
        left: { style: "thin", color: { argb: BORDER_COLOR } },
        bottom: { style: "thin", color: { argb: BORDER_COLOR } },
        right: { style: "thin", color: { argb: BORDER_COLOR } },
      };
    }
  }
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

async function appendElement(
  workbook: Workbook,
  worksheet: Worksheet,
  element: Element,
  columnCount: number,
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
  if (["ul", "ol"].includes(tagName)) {
    for (const child of Array.from(element.children)) {
      await appendElement(workbook, worksheet, child, columnCount);
    }
    return;
  }

  const text = getText(element);
  if (text) {
    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName.slice(1));
      addTextRow(worksheet, text, columnCount, {
        bold: true,
        fontSize: Math.max(14, 22 - level * 2),
        horizontal: level === 1 ? "center" : "left",
      });
    } else if (tagName === "li") {
      addTextRow(worksheet, `${listItemPrefix(element)}${text}`, columnCount, {
        indent: 1,
      });
    } else if (tagName === "blockquote") {
      addTextRow(worksheet, text, columnCount, { indent: 1 });
    } else {
      addTextRow(worksheet, text, columnCount);
    }
    return;
  }

  for (const child of Array.from(element.children)) {
    await appendElement(workbook, worksheet, child, columnCount);
  }
}

export async function createStandardXlsxBlob(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
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
