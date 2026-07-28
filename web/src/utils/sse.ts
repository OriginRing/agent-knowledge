import type { ChatNode } from "@view/interfaces/agent-interface";

export const createSseParser = () => {
  let buffer = "";
  return {
    push(chunk: string): unknown[] {
      buffer += chunk.replace(/\r\n/g, "\n");
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";
      const events: unknown[] = [];
      for (const block of blocks) {
        const data = block
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        try {
          events.push(JSON.parse(data));
        } catch {
          // 保留网络半包；完整但非法的服务端事件不影响后续流。
        }
      }
      return events;
    },
  };
};

export const upsertChatNode = (
  nodes: ChatNode[],
  incoming: ChatNode,
): ChatNode[] => {
  const index = nodes.findIndex((node) => node.id === incoming.id);
  if (index < 0) return [...nodes, incoming];
  const current = nodes[index];
  const next = [...nodes];
  next[index] = {
    ...current,
    ...incoming,
    details: {
      ...current.details,
      ...incoming.details,
    },
  };
  return next;
};
