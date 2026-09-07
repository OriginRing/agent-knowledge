// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import HistoryScrollTitle from "./history-scroll-title.vue";

describe("HistoryScrollTitle", () => {
  let resizeCallback: ResizeObserverCallback;
  let nextFrameId: number;
  let frameCallbacks: Map<number, FrameRequestCallback>;

  beforeEach(() => {
    nextFrameId = 0;
    frameCallbacks = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      nextFrameId += 1;
      frameCallbacks.set(nextFrameId, callback);
      return nextFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (frameId: number) => {
      frameCallbacks.delete(frameId);
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe() {}
        disconnect() {}
      },
    );
  });

  const runNextFrame = () => {
    const entry = frameCallbacks.entries().next().value as
      | [number, FrameRequestCallback]
      | undefined;
    if (!entry) throw new Error("没有待执行的布局帧");
    frameCallbacks.delete(entry[0]);
    entry[1](0);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only enables scrolling when the title overflows", async () => {
    let viewportWidth = 0;
    let textWidth = 0;
    const wrapper = mount(HistoryScrollTitle, {
      props: { text: "这是一条很长的历史对话标题" },
    });
    const viewport = wrapper.element as HTMLElement;
    const text = wrapper.get(".history-scroll-title__text")
      .element as HTMLElement;

    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      get: () => viewportWidth,
    });
    Object.defineProperty(text, "scrollWidth", {
      configurable: true,
      get: () => textWidth,
    });
    runNextFrame();

    viewportWidth = 100;
    textWidth = 244;
    runNextFrame();
    await nextTick();

    expect(wrapper.classes()).toContain("is-overflowing");
    expect(wrapper.attributes("style")).toContain(
      "--history-scroll-distance: 144px",
    );
    expect(wrapper.attributes("title")).toBe("这是一条很长的历史对话标题");

    textWidth = 80;
    resizeCallback([], {} as ResizeObserver);
    runNextFrame();
    await nextTick();

    expect(wrapper.classes()).not.toContain("is-overflowing");
  });
});
