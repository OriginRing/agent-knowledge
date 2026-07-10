import MarkdownIt from "markdown-it";

// 初始化 markdown-it 实例
const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
});

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
