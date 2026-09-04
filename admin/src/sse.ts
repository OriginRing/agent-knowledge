/** Decode streaming UTF-8 without assuming network chunks match SSE boundaries. */
export async function* readEvents(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<Record<string, any>> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const parse = (block: string) => {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    return data ? (JSON.parse(data) as Record<string, any>) : null;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let boundary: RegExpExecArray | null;
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = parse(buffer.slice(0, boundary.index));
        buffer = buffer.slice(boundary.index + boundary[0].length);
        if (event) yield event;
      }
      if (done) {
        const event = parse(buffer);
        if (event) yield event;
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
