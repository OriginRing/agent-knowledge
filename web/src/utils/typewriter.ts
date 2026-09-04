import MarkdownIt from "markdown-it";
import { GPTVis } from "@antv/gpt-vis";
import { useThemeStore } from "@view/stores/theme";
import { copyToClipboard } from "@view/utils/copy";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { RenderRule } from "markdown-it/dist/index.cjs";

export class GPTVisElement extends HTMLElement {
  private _instance?: GPTVis;
  private _syntax = "";
  private _fullscreen = false;
  private _resizeFrame?: number;
  private _resizeObserver?: ResizeObserver;
  private _renderedWidth = 0;

  private readonly handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape" && this._fullscreen) {
      this.setFullscreen(false);
    }
  };

  private readonly handleResize = () => {
    if (!this._fullscreen) return;
    this.scheduleRender();
  };

  private readonly handleContainerResize = (entries: ResizeObserverEntry[]) => {
    if (this._fullscreen) return;
    const width = Math.floor(entries[0]?.contentRect.width ?? 0);
    if (width > 0 && width !== this._renderedWidth) this.scheduleRender();
  };

  private scheduleRender() {
    if (this._resizeFrame) window.cancelAnimationFrame(this._resizeFrame);
    this._resizeFrame = window.requestAnimationFrame(() => this.renderChart());
  }

  connectedCallback() {
    this._syntax = decodeURIComponent(this.dataset.syntax ?? "");
    document.addEventListener("keydown", this.handleKeydown);
    window.addEventListener("resize", this.handleResize);
    if (typeof ResizeObserver !== "undefined") {
      this._resizeObserver = new ResizeObserver(this.handleContainerResize);
      this._resizeObserver.observe(this);
    }
    this.renderChart();
  }

  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeydown);
    window.removeEventListener("resize", this.handleResize);
    this._resizeObserver?.disconnect();
    if (this._resizeFrame) window.cancelAnimationFrame(this._resizeFrame);
    this._instance?.destroy();
    if (this._fullscreen) {
      document.body.classList.remove("gpt-vis-fullscreen-open");
    }
  }

  private renderChart() {
    this._instance?.destroy();
    const containerWidth = Math.floor(this.getBoundingClientRect().width);
    const width = this._fullscreen
      ? Math.max(window.innerWidth - 32, 320)
      : containerWidth || 300;
    const height = this._fullscreen
      ? Math.max(window.innerHeight - 88, 320)
      : undefined;
    this._renderedWidth = width;

    this._instance = new GPTVis({
      container: this,
      wrapper: true,
      width,
      ...(height ? { height } : {}),
      locale: "zh-CN",
    });
    this._instance.render(this._syntax);
    this.installFullscreenButton();
  }

  private installFullscreenButton() {
    const toolbar = this.querySelector<HTMLElement>(
      ".gpt-vis-wrapper-tab-right",
    );
    if (!toolbar) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gpt-vis-wrapper-text-button gpt-vis-fullscreen-button";
    button.dataset.action = "fullscreen";
    button.setAttribute("aria-pressed", String(this._fullscreen));
    button.setAttribute(
      "aria-label",
      this._fullscreen ? "退出全屏图表" : "全屏查看图表",
    );
    button.title = this._fullscreen ? "退出全屏" : "全屏";
    button.innerHTML = this._fullscreen
      ? '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M9 3v6H3v2h8V3H9Zm6 0h-2v8h8V9h-6V3ZM3 13v2h6v6h2v-8H3Zm10 0v8h2v-6h6v-2h-8Z"/></svg><span>退出全屏</span>'
      : '<svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3v6h2V5h4V3H3Zm12 0v2h4v4h2V3h-6ZM3 15v6h6v-2H5v-4H3Zm16 0v4h-4v2h6v-6h-2Z"/></svg><span>全屏</span>';
    button.addEventListener("click", () =>
      this.setFullscreen(!this._fullscreen),
    );

    const downloadButton = toolbar.querySelector('[data-action="download"]');
    toolbar.insertBefore(button, downloadButton);
  }

  private setFullscreen(enabled: boolean) {
    this._fullscreen = enabled;
    this.toggleAttribute("data-fullscreen", enabled);
    document.body.classList.toggle("gpt-vis-fullscreen-open", enabled);
    this.renderChart();
    this.querySelector<HTMLButtonElement>(
      '[data-action="fullscreen"]',
    )?.focus();
  }
}

if (!customElements.get("gpt-vis")) {
  customElements.define("gpt-vis", GPTVisElement);
}

export class MarkdownCodeBlockElement extends HTMLElement {
  private _feedbackTimer?: number;
  private readonly _editId = `code-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  private readonly handleClick = async (event: Event) => {
    const target = event.target as Element | null;
    const editButton = target?.closest<HTMLButtonElement>(
      ".markdown-code-edit",
    );
    if (editButton) {
      this.handleEdit();
      return;
    }

    const button = target?.closest<HTMLButtonElement>(".markdown-code-copy");
    const code = this.querySelector("code");
    if (!button || !code || button.disabled) return;

    button.disabled = true;
    const copied = await copyToClipboard(code.textContent ?? "");
    button.disabled = false;
    if (!copied) return;

    button.dataset.copied = "true";
    button.setAttribute("aria-label", "代码已复制");
    button.title = "代码已复制";

    window.clearTimeout(this._feedbackTimer);
    this._feedbackTimer = window.setTimeout(() => {
      button.dataset.copied = "false";
      button.setAttribute("aria-label", "复制代码");
      button.title = "复制代码";
    }, 2000);
  };

  private readonly handleEdit = () => {
    const code = this.querySelector("code");
    if (!code) return;
    this.dispatchEvent(
      new CustomEvent("markdown-code-edit", {
        bubbles: true,
        composed: true,
        detail: {
          id: this._editId,
          code: code.textContent ?? "",
          language:
            this.querySelector(
              ".markdown-code-language",
            )?.textContent?.trim() || "text",
        },
      }),
    );
  };

  connectedCallback() {
    this.addEventListener("click", this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener("click", this.handleClick);
    window.clearTimeout(this._feedbackTimer);
  }
}

if (!customElements.get("markdown-code-block")) {
  customElements.define("markdown-code-block", MarkdownCodeBlockElement);
}

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
});

// ✅ 补全：保存默认 fence 规则并自定义拦截逻辑
const defaultFence = md.renderer.rules.fence as RenderRule;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const info = token.info.trim();

  // 仅拦截以 vis 开头的代码块
  if (info.startsWith("vis")) {
    // 拼接语言标识和代码内容，作为 GPTVis 的语法
    const syntax =
      info +
      "\n" +
      token.content +
      `theme ${useThemeStore().getToggleDark ? "dark" : "light"}`;
    // 编码语法以避免 HTML 属性解析错误
    const encodedSyntax = encodeURIComponent(syntax);
    return `<div style="width: 100%; height: fit-content; margin: 12px 0"><gpt-vis data-syntax="${encodedSyntax}" style="display:block; width: 100%; height:fit-content; overflow: hidden"></gpt-vis></div>`;
  }

  const language = info.split(/\s+/)[0] || "text";
  const escapedLanguage = md.utils.escapeHtml(language);
  const code = defaultFence(tokens, idx, options, env, self);

  return `<markdown-code-block class="markdown-code-block"><div class="markdown-code-toolbar"><span class="markdown-code-language">${escapedLanguage}</span><div class="markdown-code-actions"><button class="markdown-code-edit" type="button" aria-label="编辑代码" title="编辑代码"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7L3 17.3Zm17.7-10.2a1 1 0 0 0 0-1.4l-2.4-2.4a1 1 0 0 0-1.4 0L15 5.2l3.7 3.7 2-1.8Z"/></svg></button><button class="markdown-code-copy" type="button" aria-label="复制代码" title="复制代码" data-copied="false"><svg class="markdown-code-copy-icon" aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg><svg class="markdown-code-check-icon" aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="m9 16.2-4.2-4.2-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z"/></svg></button></div></div>${code}</markdown-code-block>`;
};

/**
 * 将 Markdown 字符串转换为 HTML
 * @param {string} content - Markdown 内容
 * @returns {string} - HTML 字符串
 */
export function renderMarkdown(content: string): string {
  if (!content) return "对话失败，暂无内容";
  const text = content.replace(/\\n/g, "\n");
  return md.render(text);
}

/**
 * 渲染流式 Markdown，并让最新输出的一小段文字从实色自然淡出。
 * 只处理最后一个文本节点，避免破坏 Markdown 生成的标签结构。
 */
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
      !parent?.closest("button, .markdown-code-toolbar, gpt-vis")
    ) {
      lastTextNode = node;
    }
  }

  if (!lastTextNode) return html;

  const characters = Array.from(lastTextNode.data);
  const trailingWhitespace = lastTextNode.data.match(/\s*$/)?.[0] ?? "";
  const visibleCharacterCount = Array.from(
    lastTextNode.data.slice(
      0,
      lastTextNode.data.length - trailingWhitespace.length,
    ),
  ).length;
  const tailStart = Math.max(0, visibleCharacterCount - tailLength);
  const prefix = characters.slice(0, tailStart).join("");
  const tail = characters.slice(tailStart).join("");
  const tailElement = document.createElement("span");
  tailElement.className = "streaming-text-tail";
  tailElement.textContent = tail;

  lastTextNode.replaceWith(document.createTextNode(prefix), tailElement);
  return template.innerHTML;
}
