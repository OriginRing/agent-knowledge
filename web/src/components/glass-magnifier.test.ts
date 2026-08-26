// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GlassMagnifier from "./glass-magnifier.vue";

const { captureClasses, renderer, toCanvas } = vi.hoisted(() => ({
  captureClasses: [] as string[],
  renderer: {
    destroy: vi.fn(),
    hide: vi.fn(),
    invalidate: vi.fn(),
    move: vi.fn(),
    resize: vi.fn(),
    updateTexture: vi.fn(),
  },
  toCanvas: vi.fn(),
}));

vi.mock("@view/utils/glass-snapshot", () => ({
  captureGlassSnapshot: toCanvas,
}));

vi.mock("@view/utils/glass-renderer", () => ({
  createGlassRenderer: vi.fn(() => renderer),
}));

const mountMagnifier = () =>
  mount(GlassMagnifier, {
    global: {
      stubs: {
        teleport: true,
        SearchOutlined: true,
        AButton: {
          template:
            '<button v-bind="$attrs"><slot name="icon" /><slot /></button>',
        },
      },
    },
  });

describe("GlassMagnifier", () => {
  beforeEach(() => {
    document.body.innerHTML =
      '<div class="app-workspace"><div class="scroll-pane" style="overflow-y: auto"></div></div>';
    vi.clearAllMocks();
    captureClasses.length = 0;
    const scrollPane = document.querySelector<HTMLElement>(".scroll-pane")!;
    Object.defineProperties(scrollPane, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 100 },
    });
    toCanvas.mockImplementation(async (element: HTMLElement) => {
      captureClasses.push(element.className);
      return document.createElement("canvas");
    });
  });

  it("点击按钮后只获取工作区画面，不包含 body 浮层", async () => {
    const wrapper = mountMagnifier();

    const button = wrapper.get("button");
    await button.trigger("click");
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledOnce());

    expect(button.attributes("aria-pressed")).toBe("true");
    expect(toCanvas.mock.calls[0][0]).toBe(
      document.querySelector(".app-workspace"),
    );
    expect(captureClasses[0]).toContain("glass-capture-source");
    expect(document.querySelector(".app-workspace")?.classList).not.toContain(
      "glass-capture-source",
    );
    expect(renderer.updateTexture).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("按下工作区元素时重新获取 active 和选中状态", async () => {
    const wrapper = mountMagnifier();
    const selectedTarget =
      document.querySelector<HTMLElement>(".app-workspace");
    await wrapper.get("button").trigger("click");
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledOnce());

    selectedTarget?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
      }),
    );

    await vi.waitFor(() =>
      expect(toCanvas.mock.calls.length).toBeGreaterThan(1),
    );
    wrapper.unmount();
  });

  it("当前放大区域接收接口数据后刷新画面", async () => {
    const wrapper = mountMagnifier();
    const workspace = document.querySelector<HTMLElement>(".app-workspace")!;
    const dataTarget = document.querySelector<HTMLElement>(".scroll-pane")!;
    const visibleRect = {
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
    vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(visibleRect);
    vi.spyOn(dataTarget, "getBoundingClientRect").mockReturnValue(visibleRect);
    await wrapper.get("button").trigger("click");
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledOnce());

    dataTarget.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 50,
        clientY: 50,
      }),
    );
    dataTarget.textContent = "接口返回的新内容";

    await vi.waitFor(() =>
      expect(toCanvas.mock.calls.length).toBeGreaterThan(1),
    );
    wrapper.unmount();
  });

  it("滚动时丢弃尚未完成的旧画面并获取当前位置", async () => {
    let resolveOldCapture!: (canvas: HTMLCanvasElement) => void;
    toCanvas
      .mockImplementationOnce(async () => document.createElement("canvas"))
      .mockImplementationOnce(
        () =>
          new Promise<HTMLCanvasElement>((resolve) => {
            resolveOldCapture = resolve;
          }),
      )
      .mockImplementationOnce(async () => document.createElement("canvas"));
    const wrapper = mountMagnifier();
    const workspace = document.querySelector<HTMLElement>(".app-workspace")!;
    await wrapper.get("button").trigger("click");
    await vi.waitFor(() =>
      expect(renderer.updateTexture).toHaveBeenCalledOnce(),
    );

    workspace.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledTimes(2));
    workspace.dispatchEvent(new Event("scroll"));

    expect(renderer.invalidate).toHaveBeenCalledOnce();
    resolveOldCapture(document.createElement("canvas"));
    await vi.waitFor(() => expect(toCanvas).toHaveBeenCalledTimes(3));
    await vi.waitFor(() =>
      expect(renderer.updateTexture).toHaveBeenCalledTimes(2),
    );

    wrapper.unmount();
  });

  it("按 Esc 关闭已开启的放大镜", async () => {
    const wrapper = mountMagnifier();

    const button = wrapper.get("button");
    await button.trigger("click");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();

    expect(button.attributes("aria-pressed")).toBe("false");
    expect(button.attributes("aria-label")).toBe("开启玻璃放大镜");
    expect(renderer.destroy).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
});
