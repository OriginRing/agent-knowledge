import { describe, expect, it } from "vitest";
import { readEvents } from "./sse";
function stream(text: string, size: number) {
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += size)
        controller.enqueue(bytes.slice(i, i + size));
      controller.close();
    },
  });
}
describe("debug SSE", () => {
  it("handles split Chinese UTF-8 and events split across network chunks", async () => {
    const events = [];
    for await (const event of readEvents(
      stream('data: {"content":"你好"}\n\ndata: {"done":true}\n\n', 1),
    ))
      events.push(event);
    expect(events).toEqual([{ content: "你好" }, { done: true }]);
  });
  it("handles CRLF, comments and a terminal event without a trailing delimiter", async () => {
    const events = [];
    for await (const event of readEvents(
      stream(': keepalive\r\n\r\ndata: {"error":"节点失败","done":true}', 3),
    ))
      events.push(event);
    expect(events).toEqual([{ error: "节点失败", done: true }]);
  });
  it("surfaces invalid server data instead of silently reporting success", async () => {
    await expect(
      (async () => {
        for await (const event of readEvents(stream("data: invalid\n\n", 4)))
          void event;
      })(),
    ).rejects.toThrow();
  });
});
