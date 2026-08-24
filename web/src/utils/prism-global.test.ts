import { describe, expect, it } from "vitest";

import { Prism } from "./prism-global";

describe("Prism global bootstrap", () => {
  it("为动态语言组件注册全局 Prism", () => {
    expect(
      (globalThis as typeof globalThis & { Prism?: typeof Prism }).Prism,
    ).toBe(Prism);
  });
});
