import { describe, expect, it } from "vitest";
import type { ChatNode } from "@view/interfaces/agent-interface";
import { createSseParser, upsertChatNode } from "./sse";

describe("createSseParser", () => {
  it("保留跨网络分片的半条 SSE 事件", () => {
    const parser = createSseParser();
    expect(parser.push('data: {"event":"message","content":"你')).toEqual([]);
    expect(parser.push('好"}\n\n')).toEqual([
      { event: "message", content: "你好" },
    ]);
  });

  it("一次解析多个完整事件", () => {
    const parser = createSseParser();
    expect(
      parser.push(
        'data: {"event":"node","node":{"id":"n1"}}\n\n' +
          'data: {"event":"done","done":true}\n\n',
      ),
    ).toHaveLength(2);
  });
});

describe("upsertChatNode", () => {
  it("按节点 ID 合并状态并保留开始时间和详情", () => {
    const running: ChatNode = {
      id: "skill-search",
      kind: "skill",
      name: "web_search",
      title: "正在搜索",
      summary: "正在搜索",
      status: "running",
      details: { query: "天气" },
      startedAt: "2026-01-01T00:00:00Z",
    };
    const completed: ChatNode = {
      id: "skill-search",
      kind: "skill",
      name: "web_search",
      title: "搜索完成",
      summary: "搜索完成",
      status: "success",
      details: { items: [{ title: "结果" }] },
      finishedAt: "2026-01-01T00:00:01Z",
    };
    const result = upsertChatNode([running], completed);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("success");
    expect(result[0].startedAt).toBe(running.startedAt);
    expect(result[0].details.query).toBe("天气");
    expect(result[0].details.items).toHaveLength(1);
  });
});
