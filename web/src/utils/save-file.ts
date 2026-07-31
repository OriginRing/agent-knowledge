import { snapdom } from "@zumer/snapdom";
import { message } from "ant-design-vue";
import { asBlob } from "html-docx-js-typescript";
import { saveAs } from "file-saver";

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

export async function saveDocx(
  elementId: string,
  fileName = Date.now().toString(),
) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const customCss = `
        body { font-family: '微软雅黑', sans-serif; font-size: 14px; color: #333; }
        h1 { color: #1a73e8; font-size: 24px; margin-bottom: 10px; text-align: center; }
        p { line-height: 1.6; text-indent: 2em; }
        img {
          display: block !important;  
          max-width: 620px !important;
          width: 100% !important;
          height: auto !important;
          margin: 0 auto !important;
          padding: 0 !important;
          vertical-align: middle !important;
        }
    `;

  const options = {
    orientation: "portrait",
    margins: {
      top: 1440,
      right: 1440,
      bottom: 1440,
      left: 1440,
    },
    font: {
      name: "微软雅黑",
      size: 28,
    },
  };

  try {
    const exportContent = await prepareDocxContent(element);
    const fullHtml = `
          <!DOCTYPE html>
          <html>
              <head><meta charset="UTF-8"><style>${customCss}</style></head>
              <body>${exportContent.html}</body>
          </html>`;
    // @ts-expect-error html-docx-js-typescript 的类型定义缺少可用的默认导出签名
    const blob: Blob = (await asBlob(fullHtml, options)) as unknown as Blob;
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
