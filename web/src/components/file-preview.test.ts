// @vitest-environment happy-dom
/* eslint-disable vue/one-component-per-file */

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent, h } from "vue";
import { describe, expect, it, vi } from "vitest";

import FilePreview from "./file-preview.vue";

vi.mock("@ant-design/icons-vue", () => ({
  CloseOutlined: defineComponent({
    name: "CloseOutlined",
    setup: () => () => h("span"),
  }),
}));

vi.mock("@open-file-viewer/vue", () => ({
  OpenFileViewer: defineComponent({
    name: "OpenFileViewer",
    props: {
      file: { type: Object, required: true },
      fileName: { type: String, required: true },
      plugins: { type: Array, required: true },
      toolbar: { type: [Boolean, Object], default: undefined },
    },
    setup(_, { expose }) {
      expose({ reload: vi.fn() });
      return () =>
        h("div", [h("a", { class: "plugin-download", download: "test.txt" })]);
    },
  }),
}));

vi.mock("@open-file-viewer/core", () => {
  const plugin = (name: string) => () => ({ name });
  return {
    archivePlugin: plugin("archive"),
    audioPlugin: plugin("audio"),
    cadPlugin: plugin("cad"),
    drawingPlugin: plugin("drawing"),
    emailPlugin: plugin("email"),
    fallbackPlugin: plugin("fallback"),
    gisPlugin: plugin("gis"),
    imagePlugin: plugin("image"),
    model3dPlugin: plugin("model3d"),
    officePlugin: plugin("office"),
    ofdPlugin: plugin("ofd"),
    pdfPlugin: plugin("pdf"),
    textPlugin: plugin("text"),
    videoPlugin: plugin("video"),
  };
});

describe("FilePreview", () => {
  it("keeps OFD handling reachable instead of registering an early fallback", () => {
    const file = new File(["ofd"], "invoice.ofd", {
      type: "application/ofd",
    });
    const wrapper = mount(FilePreview, {
      props: { file },
      global: {
        plugins: [createPinia()],
        stubs: { AButton: true },
      },
    });

    const plugins = wrapper
      .getComponent({ name: "OpenFileViewer" })
      .props("plugins") as Array<{ name: string }>;

    expect(plugins.map(({ name }) => name)).toContain("ofd");
    expect(
      plugins.indexOf(plugins.find(({ name }) => name === "ofd")!),
    ).toBeLessThan(
      plugins.indexOf(plugins.find(({ name }) => name === "fallback")!),
    );
  });

  it("disables download and print and blocks plugin download links", () => {
    const wrapper = mount(FilePreview, {
      props: { file: new File(["content"], "report.txt") },
      global: {
        plugins: [createPinia()],
        stubs: { AButton: true },
      },
    });

    const viewer = wrapper.getComponent({ name: "OpenFileViewer" });
    expect(viewer.props("toolbar")).toEqual({
      download: false,
      print: false,
    });

    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    viewer.get("a.plugin-download").element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});
