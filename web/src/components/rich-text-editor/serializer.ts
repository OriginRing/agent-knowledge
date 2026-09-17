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

export const serializePlainTextDocument = (document: JSONContent): string => {
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

// 保留旧名称，避免已有调用方在迁移到明确的纯文本/Markdown API 时中断。
export const serializeRichTextDocument = serializePlainTextDocument;

const escapeMarkdownText = (value: string): string =>
  value.replace(/([\\`*_[\]~<>])/g, "\\$1");

const escapeLinkDestination = (value: string): string =>
  value.replace(/([\\()])/g, "\\$1");

const serializeCodeMark = (value: string): string => {
  const matches = value.match(/`+/g);
  const fence = "`".repeat(
    Math.max(1, ...(matches ?? []).map((match) => match.length + 1)),
  );
  const padding = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${padding}${value}${padding}${fence}`;
};

const escapeLinkTitle = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const serializeInline = (node: JSONContent): string => {
  if (node.type === "hardBreak") return "  \n";
  if (node.type === "image") {
    const alt = String(node.attrs?.alt ?? "").replace(/([\\[\]])/g, "\\$1");
    const src = escapeLinkDestination(String(node.attrs?.src ?? ""));
    const title = node.attrs?.title
      ? ` "${escapeLinkTitle(String(node.attrs.title))}"`
      : "";
    return `![${alt}](${src}${title})`;
  }
  if (typeof node.text !== "string") {
    return (node.content ?? []).map(serializeInline).join("");
  }

  const marks = node.marks ?? [];
  const code = marks.find((mark) => mark.type === "code");
  let value = code
    ? serializeCodeMark(node.text)
    : escapeMarkdownText(node.text);

  if (!code) {
    if (marks.some((mark) => mark.type === "bold")) value = `**${value}**`;
    if (marks.some((mark) => mark.type === "italic")) value = `*${value}*`;
    if (marks.some((mark) => mark.type === "strike")) value = `~~${value}~~`;
  }

  const link = marks.find((mark) => mark.type === "link");
  if (link?.attrs?.href) {
    const href = escapeLinkDestination(String(link.attrs.href));
    const title = link.attrs.title
      ? ` "${escapeLinkTitle(String(link.attrs.title))}"`
      : "";
    value = `[${value}](${href}${title})`;
  }

  return value;
};

const serializeMarkdownList = (node: JSONContent, depth = 0): string => {
  const ordered = node.type === "orderedList";
  const start = Number(node.attrs?.start ?? 1);

  return (node.content ?? [])
    .map((item, index) => {
      const children = item.content ?? [];
      const nestedLists = children.filter((child) =>
        ["bulletList", "orderedList", "taskList"].includes(child.type ?? ""),
      );
      const contentBlocks = children.filter(
        (child) =>
          !["bulletList", "orderedList", "taskList"].includes(child.type ?? ""),
      );
      const content = contentBlocks
        .map(serializeMarkdownBlock)
        .filter(Boolean)
        .join("\n\n");
      const marker = ordered ? `${start + index}. ` : "- ";
      const indentation = "  ".repeat(depth);
      const contentLines = content.split("\n");
      const firstLine = `${indentation}${marker}${contentLines.shift() ?? ""}`;
      const continuation = contentLines
        .map((line) => `${indentation}  ${line}`)
        .join("\n");
      const nested = nestedLists
        .map((list) =>
          list.type === "taskList"
            ? serializeMarkdownTaskList(list, depth + 1)
            : serializeMarkdownList(list, depth + 1),
        )
        .filter(Boolean)
        .join("\n");
      return [firstLine, continuation, nested].filter(Boolean).join("\n");
    })
    .join("\n");
};

const serializeMarkdownTaskList = (node: JSONContent, depth = 0): string =>
  (node.content ?? [])
    .map((item) => {
      const children = item.content ?? [];
      const nestedLists = children.filter((child) =>
        ["bulletList", "orderedList", "taskList"].includes(child.type ?? ""),
      );
      const content = children
        .filter(
          (child) =>
            !["bulletList", "orderedList", "taskList"].includes(
              child.type ?? "",
            ),
        )
        .map(serializeMarkdownBlock)
        .filter(Boolean)
        .join("\n\n");
      const marker = item.attrs?.checked ? "- [x] " : "- [ ] ";
      const indentation = "  ".repeat(depth);
      const contentLines = content.split("\n");
      const firstLine = `${indentation}${marker}${contentLines.shift() ?? ""}`;
      const continuation = contentLines
        .map((line) => `${indentation}  ${line}`)
        .join("\n");
      const nested = nestedLists
        .map((list) =>
          list.type === "taskList"
            ? serializeMarkdownTaskList(list, depth + 1)
            : serializeMarkdownList(list, depth + 1),
        )
        .filter(Boolean)
        .join("\n");
      return [firstLine, continuation, nested].filter(Boolean).join("\n");
    })
    .join("\n");

const serializeMarkdownTable = (node: JSONContent): string => {
  const rows = (node.content ?? []).map((row) =>
    (row.content ?? []).map((cell) =>
      serializeInline(cell)
        .trim()
        .replace(/\|/g, "\\|")
        .replace(/\s*\n\s*/g, " "),
    ),
  );
  if (!rows.length) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizeRow = (row: string[]) =>
    `| ${Array.from({ length: columnCount }, (_, index) => row[index] ?? "").join(" | ")} |`;
  const [header = [], ...body] = rows;
  return [
    normalizeRow(header),
    normalizeRow(Array.from({ length: columnCount }, () => "---")),
    ...body.map(normalizeRow),
  ].join("\n");
};

function serializeMarkdownBlock(node: JSONContent): string {
  switch (node.type) {
    case "heading":
      return `${"#".repeat(Number(node.attrs?.level ?? 1))} ${serializeInline(node)}`;
    case "bulletList":
    case "orderedList":
      return serializeMarkdownList(node);
    case "taskList":
      return serializeMarkdownTaskList(node);
    case "blockquote":
      return (node.content ?? [])
        .map(serializeMarkdownBlock)
        .filter(Boolean)
        .join("\n\n")
        .split("\n")
        .map((line) => (line ? `> ${line}` : ">"))
        .join("\n");
    case "table":
      return serializeMarkdownTable(node);
    case "image":
      return serializeInline(node);
    default:
      return serializeInline(node).trim();
  }
}

export const serializeMarkdownDocument = (document: JSONContent): string =>
  (document.content ?? [])
    .map(serializeMarkdownBlock)
    .filter(Boolean)
    .join("\n\n")
    .trim();
