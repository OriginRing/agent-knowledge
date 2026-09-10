import type { JSONContent } from "@tiptap/vue-3";

export type MemoryEditorInputFormat = "html" | "markdown" | "text";

export interface MemoryEditorContent {
  html: string;
  text: string;
}

export const createTextDocument = (content: string): JSONContent => {
  const normalized = content.replace(/\r\n?/g, "\n");
  const blocks = normalized.split(/\n{2,}/);

  return {
    type: "doc",
    content: blocks.map((block) => {
      const lines = block.split("\n");
      const paragraphContent = lines.flatMap<JSONContent>((line, index) => {
        const nodes: JSONContent[] = [];
        if (index > 0) nodes.push({ type: "hardBreak" });
        if (line) nodes.push({ type: "text", text: line });
        return nodes;
      });

      return {
        type: "paragraph",
        content: paragraphContent.length ? paragraphContent : undefined,
      };
    }),
  };
};
