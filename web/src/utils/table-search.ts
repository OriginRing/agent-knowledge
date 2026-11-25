/** 在表格单元格的完整文本中查找，跨行内标签的匹配共享同一个序号。 */
export function searchTable(html: string, query: string) {
  if (!query) return { html, count: 0 };

  const template = document.createElement("template");
  template.innerHTML = html;
  const pattern = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    "gi",
  );
  let count = 0;

  template.content.querySelectorAll("th, td").forEach((cell) => {
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.parentElement?.closest("script, style, table") ===
        cell.closest("table")
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });
    const nodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) nodes.push(node as Text);
    const text = nodes.map((textNode) => textNode.data).join("");
    const matches = Array.from(text.matchAll(pattern), (match) => ({
      start: match.index!,
      end: match.index! + match[0].length,
      index: count++,
    }));
    if (!matches.length) return;
    let offset = 0;

    for (const textNode of nodes) {
      const end = offset + textNode.length;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      for (const match of matches) {
        const start = Math.max(match.start, offset) - offset;
        const stop = Math.min(match.end, end) - offset;
        if (start >= stop) continue;
        fragment.append(textNode.data.slice(cursor, start));
        const mark = document.createElement("mark");
        mark.dataset.tableMatch = String(match.index);
        mark.textContent = textNode.data.slice(start, stop);
        fragment.append(mark);
        cursor = stop;
      }
      fragment.append(textNode.data.slice(cursor));
      textNode.replaceWith(fragment);
      offset = end;
    }
  });

  return { html: template.innerHTML, count };
}
