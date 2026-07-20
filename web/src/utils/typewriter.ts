import MarkdownIt from "markdown-it";
import { GPTVis } from "@antv/gpt-vis";
import { useThemeStore } from "@view/stores/theme";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { RenderRule } from "markdown-it/dist/index.cjs";

export class GPTVisElement extends HTMLElement {
  connectedCallback() {
    const syntax = decodeURIComponent(<string>this.dataset.syntax);
    console.log(111);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._instance = new GPTVis({
      container: this,
      wrapper: true,
      width: 800,
      locale: "zh-CN",
    });
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._instance.render(syntax);
  }
  disconnectedCallback() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this._instance?.destroy();
  }
}

if (!customElements.get("gpt-vis")) {
  customElements.define("gpt-vis", GPTVisElement);
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
    console.log(info, token);
    const syntax =
      info +
      "\n" +
      token.content +
      `theme ${useThemeStore().getToggleDark ? "dark" : "light"}`;
    // 编码语法以避免 HTML 属性解析错误
    const encodedSyntax = encodeURIComponent(syntax);
    return `<div style="width: 100%; height: fit-content; margin: 12px 0"><gpt-vis data-syntax="${encodedSyntax}" style="display:block; width: 100%; height:fit-content; overflow: hidden"></gpt-vis></div>`;
  }

  // 非 vis 代码块，回退到默认渲染行为
  return defaultFence(tokens, idx, options, env, self);
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
