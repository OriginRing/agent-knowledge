import * as echarts from "echarts";
import type { ECharts, EChartsOption } from "echarts";
import MarkdownIt from "markdown-it";

import { copyToClipboard } from "@view/utils/copy";

const DEFAULT_CHART_HEIGHT = 420;
const MIN_CHART_HEIGHT = 240;
const MAX_CHART_HEIGHT = 1200;

function parseChartOption(source: string): EChartsOption {
  const normalized = source
    .trim()
    .replace(/^\s*(?:(?:const|let|var)\s+)?option\s*=\s*/, "")
    .replace(/;\s*$/, "");
  const option: unknown = JSON.parse(normalized);

  if (!option || Array.isArray(option) || typeof option !== "object") {
    throw new TypeError("ECharts option 必须是 JSON 对象");
  }

  return option as EChartsOption;
}

function getChartHeight(info: string): number {
  const value = info.match(/(?:^|\s)height=(\d+)(?:\s|$)/)?.[1];
  const height = value ? Number(value) : DEFAULT_CHART_HEIGHT;
  return Math.min(Math.max(height, MIN_CHART_HEIGHT), MAX_CHART_HEIGHT);
}

export class EChartsElement extends HTMLElement {
  private chart?: ECharts;
  private canvas?: HTMLDivElement;
  private resizeObserver?: ResizeObserver;
  private themeObserver?: MutationObserver;
  private resizeFrame?: number;
  private fullscreen = false;
  private renderedTheme?: "dark" | undefined;

  private readonly handleWindowResize = () => this.scheduleResize();

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this.fullscreen) {
      this.setFullscreen(false);
    }
  };

  connectedCallback() {
    this.buildLayout();
    this.renderChart();
    this.observeSize();
    this.observeTheme();
    document.addEventListener("keydown", this.handleKeydown);
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("resize", this.handleWindowResize);
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
    this.chart?.dispose();
    if (this.fullscreen) {
      document.body.classList.remove("echarts-fullscreen-open");
    }
  }

  private buildLayout() {
    this.replaceChildren();
    this.classList.add("echarts-chart");

    const toolbar = document.createElement("div");
    toolbar.className = "echarts-chart-toolbar";

    const label = document.createElement("span");
    label.className = "echarts-chart-label";
    label.textContent = "ECharts";

    const fullscreenButton = document.createElement("button");
    fullscreenButton.type = "button";
    fullscreenButton.className = "echarts-chart-fullscreen";
    fullscreenButton.dataset.action = "fullscreen";
    fullscreenButton.addEventListener("click", () => {
      this.setFullscreen(!this.fullscreen);
    });

    toolbar.append(label, fullscreenButton);

    this.canvas = document.createElement("div");
    this.canvas.className = "echarts-chart-canvas";
    this.canvas.style.height = `${this.chartHeight}px`;
    this.append(toolbar, this.canvas);
    this.updateFullscreenButton();
  }

  private renderChart() {
    if (!this.canvas) return;

    try {
      const source = decodeURIComponent(this.dataset.option ?? "");
      const option = parseChartOption(source);
      this.renderedTheme = this.currentTheme;
      this.chart?.dispose();
      this.chart = echarts.init(this.canvas, this.renderedTheme, {
        renderer: "canvas",
      });
      this.chart.setOption(option, { notMerge: true });
      this.removeAttribute("data-error");
    } catch (error) {
      this.chart?.dispose();
      this.chart = undefined;
      this.setAttribute("data-error", "true");
      this.canvas.textContent = `ECharts 配置解析失败：${
        error instanceof Error ? error.message : String(error)
      }`;
    }
  }

  private observeSize() {
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", this.handleWindowResize);
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(this);
  }

  private observeTheme() {
    this.themeObserver = new MutationObserver(() => {
      if (this.currentTheme !== this.renderedTheme) this.renderChart();
    });
    this.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
  }

  private scheduleResize() {
    if (this.resizeFrame) window.cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = window.requestAnimationFrame(() => {
      this.resizeFrame = undefined;
      this.chart?.resize();
    });
  }

  private setFullscreen(enabled: boolean) {
    this.fullscreen = enabled;
    this.toggleAttribute("data-fullscreen", enabled);
    document.body.classList.toggle("echarts-fullscreen-open", enabled);
    this.updateFullscreenButton();
    this.scheduleResize();
    this.querySelector<HTMLButtonElement>(
      '[data-action="fullscreen"]',
    )?.focus();
  }

  private updateFullscreenButton() {
    const button = this.querySelector<HTMLButtonElement>(
      '[data-action="fullscreen"]',
    );
    if (!button) return;

    const label = this.fullscreen ? "退出全屏" : "全屏查看图表";
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(this.fullscreen));
    button.title = label;
    button.innerHTML = this.fullscreen
      ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M9 3v6H3v2h8V3H9Zm6 0h-2v8h8V9h-6V3ZM3 13v2h6v6h2v-8H3Zm10 0v8h2v-6h6v-2h-8Z"/></svg>'
      : '<svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M3 3v6h2V5h4V3H3Zm12 0v2h4v4h2V3h-6ZM3 15v6h6v-2H5v-4H3Zm16 0v4h-4v2h6v-6h-2Z"/></svg>';
  }

  private get currentTheme(): "dark" | undefined {
    return document.documentElement.classList.contains("dark")
      ? "dark"
      : undefined;
  }

  private get chartHeight(): number {
    const height = Number(this.dataset.height);
    return Number.isFinite(height) ? height : DEFAULT_CHART_HEIGHT;
  }
}

if (!customElements.get("echarts-chart")) {
  customElements.define("echarts-chart", EChartsElement);
}

export class EChartsMarkdownCodeBlockElement extends HTMLElement {
  private feedbackTimer?: number;

  private readonly handleClick = async (event: Event) => {
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      ".markdown-code-copy",
    );
    const code = this.querySelector("code");
    if (!button || !code || button.disabled) return;

    button.disabled = true;
    const copied = await copyToClipboard(code.textContent ?? "");
    button.disabled = false;
    if (!copied) return;

    button.dataset.copied = "true";
    button.setAttribute("aria-label", "代码已复制");
    button.title = "代码已复制";
    window.clearTimeout(this.feedbackTimer);
    this.feedbackTimer = window.setTimeout(() => {
      button.dataset.copied = "false";
      button.setAttribute("aria-label", "复制代码");
      button.title = "复制代码";
    }, 2000);
  };

  connectedCallback() {
    this.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    window.clearTimeout(this.feedbackTimer);
  }
}

if (!customElements.get("echarts-markdown-code-block")) {
  customElements.define(
    "echarts-markdown-code-block",
    EChartsMarkdownCodeBlockElement,
  );
}

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
});

const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();
  const language = info.split(/\s+/, 1)[0]?.toLowerCase();

  if (["echart", "echarts", "echarts-json"].includes(language)) {
    const encodedOption = encodeURIComponent(token.content);
    const height = getChartHeight(info);
    return `<echarts-chart data-option="${encodedOption}" data-height="${height}"></echarts-chart>`;
  }

  const displayLanguage = language || "text";
  const escapedLanguage = md.utils.escapeHtml(displayLanguage);
  const code = defaultFence(tokens, idx, options, env, self);

  return `<echarts-markdown-code-block class="markdown-code-block"><div class="markdown-code-toolbar"><span class="markdown-code-language">${escapedLanguage}</span><div class="markdown-code-actions"><button class="markdown-code-copy" type="button" aria-label="复制代码" title="复制代码" data-copied="false"><svg class="markdown-code-copy-icon" aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg><svg class="markdown-code-check-icon" aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg></button></div></div>${code}</echarts-markdown-code-block>`;
};

/** 将 Markdown 转换为 HTML，并将 ECharts 围栏渲染为响应式图表。 */
export function renderMarkdown(content: string): string {
  if (!content) return "对话失败，暂无内容";
  return md.render(content.replace(/\\n/g, "\n"));
}

/** 渲染流式 Markdown，并为最后一段普通文本添加渐变尾巴。 */
export function renderStreamingMarkdown(
  content: string,
  tailLength = 12,
): string {
  const html = renderMarkdown(content);
  if (!content || tailLength <= 0 || typeof document === "undefined") {
    return html;
  }

  const template = document.createElement("template");
  template.innerHTML = html;
  const walker = document.createTreeWalker(
    template.content,
    NodeFilter.SHOW_TEXT,
  );
  let lastTextNode: Text | null = null;

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const parent = node.parentElement;
    if (
      node.data.trim() &&
      !parent?.closest("button, .markdown-code-toolbar, echarts-chart")
    ) {
      lastTextNode = node;
    }
  }

  if (!lastTextNode) return html;

  const trailingWhitespace = lastTextNode.data.match(/\s*$/)?.[0] ?? "";
  const visibleText = lastTextNode.data.slice(
    0,
    lastTextNode.data.length - trailingWhitespace.length,
  );
  const characters = Array.from(visibleText);
  const tailStart = Math.max(0, characters.length - tailLength);
  const tail = document.createElement("span");
  tail.className = "streaming-text-tail";
  tail.textContent = `${characters.slice(tailStart).join("")}${trailingWhitespace}`;

  lastTextNode.replaceWith(
    document.createTextNode(characters.slice(0, tailStart).join("")),
    tail,
  );
  return template.innerHTML;
}
