import { snapdom } from "@zumer/snapdom";
import { message } from "ant-design-vue";
import { saveAs } from "file-saver";

import { createStandardDocxBlob } from "./docx-export";

const A4_MAX_WIDTH = 620;
const CHART_EXPORT_ERROR_TEXT = "图表导出失败";
export interface DocxExportContent {
  html: string;
  failedChartCount: number;
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
  if (!chartContainer) {
    throw new Error("未找到 GPT-Vis 图表容器");
  }

  const snapshot = await snapdom(chartContainer, { scale: 2 });
  const image = await snapshot.toPng();
  if (!image.src.startsWith("data:image/png")) {
    throw new Error("GPT-Vis 图表未生成 PNG 数据");
  }
  return image.src;
}

export async function prepareDocxContent(
  sourceElement: HTMLElement,
): Promise<DocxExportContent> {
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
  return {
    html: clonedElement.innerHTML,
    failedChartCount,
  };
}

async function exportDocx(
  element: HTMLElement,
  fileName: string,
  isLinkBreak: boolean,
) {
  try {
    const exportContent = await prepareDocxContent(element);
    const blob = await createStandardDocxBlob(exportContent.html, {
      isLinkBreak,
    });
    saveAs(blob, fileName);
    if (exportContent.failedChartCount > 0) {
      message.warning(
        `${exportContent.failedChartCount} 个图表未能导出，已在 Word 中标注`,
      );
    }
  } catch (err) {
    console.error("导出Word失败:", err);
    message.error("导出 Word 失败，请稍后重试");
  }
}

export async function saveDocx(
  elementId: string,
  fileName = `${Date.now()}.docx`,
  isLinkBreak = true,
) {
  const element = document.getElementById(elementId);
  if (!element) return;
  await exportDocx(element, fileName, isLinkBreak);
}

export async function saveHtmlAsDocx(
  html: string,
  fileName = `${Date.now()}.docx`,
  isLinkBreak = true,
) {
  const element = document.createElement("div");
  element.innerHTML = html;
  await exportDocx(element, fileName, isLinkBreak);
}
