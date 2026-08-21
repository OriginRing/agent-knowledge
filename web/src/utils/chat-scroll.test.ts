import { describe, expect, it } from "vitest";

import { isChatScrolledToBottom } from "./chat-scroll";

describe("isChatScrolledToBottom", () => {
  it("到达底部时返回 true", () => {
    expect(
      isChatScrolledToBottom({
        scrollHeight: 1000,
        scrollTop: 600,
        clientHeight: 400,
      } as HTMLElement),
    ).toBe(true);
  });

  it("用户向上滚动后返回 false", () => {
    expect(
      isChatScrolledToBottom({
        scrollHeight: 1000,
        scrollTop: 480,
        clientHeight: 400,
      } as HTMLElement),
    ).toBe(false);
  });

  it("兼容反向滚动容器的负 scrollTop", () => {
    expect(
      isChatScrolledToBottom({
        scrollHeight: 1000,
        scrollTop: -600,
        clientHeight: 400,
      } as HTMLElement),
    ).toBe(true);
  });
});
