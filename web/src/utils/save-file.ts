import { snapdom } from "@zumer/snapdom";
import { message } from "ant-design-vue";
import { saveAs } from "file-saver";

const A4_MAX_WIDTH = 620;
const CHART_EXPORT_ERROR_TEXT = "图表导出失败";

export const DOWNLOAD_FORMATS = ["docx", "html", "xlsx"] as const;
export type DownloadFormat = (typeof DOWNLOAD_FORMATS)[number];

export interface PreparedExportContent {
  html: string;
  failedChartCount: number;
}

export type DocxExportContent = PreparedExportContent;

export function isDownloadFormat(value: unknown): value is DownloadFormat {
  return DOWNLOAD_FORMATS.includes(value as DownloadFormat);
}

function applyImageSizing(element: HTMLElement) {
  element.querySelectorAll("img").forEach((img) => {
    img.style.maxWidth = `${A4_MAX_WIDTH}px`;
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    img.style.margin = "0 auto";
    img.setAttribute("width", A4_MAX_WIDTH.toString());
    img.removeAttribute("height");
  });
}

async function captureChart(chart: Element): Promise<string> {
  const chartContainer = chart.querySelector(
    ".gpt-vis-wrapper-chart-container",
  );
  if (!chartContainer) throw new Error("未找到 GPT-Vis 图表容器");

  const snapshot = await snapdom(chartContainer, { scale: 2 });
  const image = await snapshot.toPng();
  if (!image.src.startsWith("data:image/png")) {
    throw new Error("GPT-Vis 图表未生成 PNG 数据");
  }
  return image.src;
}

export async function prepareExportContent(
  sourceElement: HTMLElement,
): Promise<PreparedExportContent> {
  const clonedElement = sourceElement.cloneNode(true) as HTMLElement;
  const sourceCharts = Array.from(sourceElement.querySelectorAll("gpt-vis"));
  const clonedCharts = Array.from(clonedElement.querySelectorAll("gpt-vis"));
  const captures = await Promise.allSettled(sourceCharts.map(captureChart));
  let failedChartCount = 0;

  captures.forEach((capture, index) => {
    const clonedChart = clonedCharts[index];
    if (!clonedChart) return;

    if (capture.status === "fulfilled") {
      const image = document.createElement("img");
      image.src = capture.value;
      image.alt = "GPT-Vis 图表";
      clonedChart.replaceWith(image);
      return;
    }

    failedChartCount += 1;
    const placeholder = document.createElement("p");
    placeholder.dataset.chartExportError = "true";
    placeholder.textContent = CHART_EXPORT_ERROR_TEXT;
    clonedChart.replaceWith(placeholder);
    console.error(CHART_EXPORT_ERROR_TEXT, capture.reason);
  });

  applyImageSizing(clonedElement);
  return { html: clonedElement.innerHTML, failedChartCount };
}

export const prepareDocxContent = prepareExportContent;

async function createExportBlob(
  html: string,
  format: DownloadFormat,
  isLinkBreak: boolean,
) {
  if (format === "docx") {
    const { createStandardDocxBlob } = await import("./docx-export");
    return createStandardDocxBlob(html, { isLinkBreak });
  }
  if (format === "xlsx") {
    const { createStandardXlsxBlob } = await import("./xlsx-export");
    return createStandardXlsxBlob(html);
  }

  const { createHtmlBlob } = await import("./save-html");
  return createHtmlBlob(html);
}

async function exportElement(
  element: HTMLElement,
  format: DownloadFormat,
  fileName: string,
  isLinkBreak = true,
  warningTarget = "导出文件",
) {
  try {
    const exportContent = await prepareExportContent(element);
    const blob = await createExportBlob(
      exportContent.html,
      format,
      isLinkBreak,
    );
    saveAs(blob, fileName);
    if (exportContent.failedChartCount > 0) {
      message.warning(
        `${exportContent.failedChartCount} 个图表未能导出，已在${warningTarget}中标注`,
      );
    }
  } catch (error) {
    const label = format === "docx" ? "Word" : format.toUpperCase();
    console.error(`导出 ${label} 失败:`, error);
    message.error(`导出 ${label} 失败，请稍后重试`);
  }
}

export async function saveChatResult(
  elementId: string,
  format: DownloadFormat,
  baseFileName = `智能体回答-${Date.now()}`,
) {
  const element = document.getElementById(elementId);
  if (!element) return;
  await exportElement(element, format, `${baseFileName}.${format}`);
}

export async function saveDocx(
  elementId: string,
  fileName = `${Date.now()}.docx`,
  isLinkBreak = true,
) {
  const element = document.getElementById(elementId);
  if (!element) return;
  await exportElement(element, "docx", fileName, isLinkBreak, " Word ");
}

export async function saveHtmlAsDocx(
  html: string,
  fileName = `${Date.now()}.docx`,
  isLinkBreak = true,
) {
  const element = document.createElement("div");
  element.innerHTML = html;
  await exportElement(element, "docx", fileName, isLinkBreak, " Word ");
}
