import type MarkdownIt from "markdown-it";

export function registerMarkdownTable(md: MarkdownIt) {
  const tableOpen = md.renderer.rules.table_open;
  const tableClose = md.renderer.rules.table_close;

  md.renderer.rules.table_open = (tokens, index, options, env, renderer) => {
    const table = tableOpen
      ? tableOpen(tokens, index, options, env, renderer)
      : renderer.renderToken(tokens, index, options);
    return `<div class="markdown-table"><div class="markdown-table-actions" data-markdown-table-actions><button type="button" class="markdown-table-preview-button markdown-table-fullscreen-button" data-markdown-table-preview aria-label="全屏查看表格" title="全屏" aria-pressed="false"><svg aria-hidden="true" viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M3 3v6h2V5h4V3H3Zm12 0v2h4v4h2V3h-6ZM3 15v6h6v-2H5v-4H3Zm16 0v4h-4v2h6v-6h-2Z"/></svg><span>全屏</span></button></div>${table}`;
  };
  md.renderer.rules.table_close = (tokens, index, options, env, renderer) => {
    const table = tableClose
      ? tableClose(tokens, index, options, env, renderer)
      : renderer.renderToken(tokens, index, options);
    return `${table}</div>\n`;
  };
}
