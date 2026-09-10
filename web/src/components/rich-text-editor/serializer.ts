import type { JSONContent } from "@tiptap/vue-3";

const inlineText = (node: JSONContent): string => {
  if (typeof node.text === "string") return node.text;
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineText).join("");
};

const serializeListItem = (node: JSONContent, depth: number): string[] => {
  const lines: string[] = [];
  const nestedLists: JSONContent[] = [];

  for (const child of node.content ?? []) {
    if (child.type === "bulletList" || child.type === "orderedList") {
      nestedLists.push(child);
      continue;
    }
    const text = inlineText(child).trim();
    if (text) lines.push(text);
  }

  const firstLine = lines.shift() ?? "";
  const continuation = lines.map((line) => `${"  ".repeat(depth + 1)}${line}`);
  const nested = nestedLists.flatMap((list) => serializeList(list, depth + 1));
  return [firstLine, ...continuation, ...nested];
};

const serializeList = (node: JSONContent, depth = 0): string[] => {
  const start =
    node.type === "orderedList" ? Number(node.attrs?.start ?? 1) : 1;
  return (node.content ?? []).flatMap((item, index) => {
    const itemLines = serializeListItem(item, depth);
    const marker = node.type === "orderedList" ? `${start + index}. ` : "- ";
    const [firstLine = "", ...rest] = itemLines;
    return [`${"  ".repeat(depth)}${marker}${firstLine}`, ...rest];
  });
};

const serializeTaskList = (node: JSONContent, depth = 0): string[] =>
  (node.content ?? []).flatMap((item) => {
    const nestedLists: JSONContent[] = [];
    const contentLines: string[] = [];
    for (const child of item.content ?? []) {
      if (child.type === "taskList") nestedLists.push(child);
      else {
        const text = inlineText(child).trim();
        if (text) contentLines.push(text);
      }
    }
    const nested = nestedLists.flatMap((list) =>
      serializeTaskList(list, depth + 1),
    );
    if (!contentLines.length) return nested;

    const marker = item.attrs?.checked ? "- [x] " : "- [ ] ";
    const [firstLine = "", ...continuation] = contentLines;
    return [
      `${"  ".repeat(depth)}${marker}${firstLine}`,
      ...continuation.map((line) => `${"  ".repeat(depth + 1)}${line}`),
      ...nested,
    ];
  });

const serializeTable = (node: JSONContent): string =>
  (node.content ?? [])
    .map((row) => {
      const cells = (row.content ?? []).map((cell) =>
        inlineText(cell).trim().replace(/\n+/g, " "),
      );
      return cells.some(Boolean) ? cells.join(" | ") : "";
    })
    .filter(Boolean)
    .join("\n");

export const serializeRichTextDocument = (document: JSONContent): string => {
  const blocks = (document.content ?? []).map((node) => {
    if (node.type === "bulletList" || node.type === "orderedList") {
      return serializeList(node).join("\n");
    }
    if (node.type === "taskList") return serializeTaskList(node).join("\n");
    if (node.type === "blockquote") {
      return (node.content ?? [])
        .map((child) => inlineText(child).trim())
        .filter(Boolean)
        .join("\n");
    }
    if (node.type === "table") return serializeTable(node);
    return inlineText(node).trim();
  });

  return blocks.filter(Boolean).join("\n\n").trim();
};
