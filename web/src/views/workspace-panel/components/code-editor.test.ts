// @vitest-environment happy-dom
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CodeEditor from "./code-editor.vue";
import { useThemeStore } from "@view/stores/theme";

const mocks = vi.hoisted(() => ({
  createModel: vi.fn(),
  create: vi.fn(),
  setTheme: vi.fn(),
  setModelLanguage: vi.fn(),
  editorDispose: vi.fn(),
  modelDispose: vi.fn(),
  subscriptionDispose: vi.fn(),
  value: "",
  change: () => {},
}));
vi.mock("@view/utils/monaco", () => ({
  monaco: {
    languages: {
      getLanguages: () =>
        ["javascript", "typescript", "plaintext"].map((id) => ({ id })),
    },
    editor: {
      createModel: mocks.createModel,
      create: mocks.create,
      setTheme: mocks.setTheme,
      setModelLanguage: mocks.setModelLanguage,
    },
  },
}));

describe("代码编辑器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setActivePinia(createPinia());
    mocks.createModel.mockImplementation((value: string) => {
      mocks.value = value;
      return {
        getValue: () => mocks.value,
        setValue: (next: string) => {
          mocks.value = next;
        },
        dispose: mocks.modelDispose,
      };
    });
    mocks.create.mockReturnValue({
      getValue: () => mocks.value,
      dispose: mocks.editorDispose,
      onDidChangeModelContent: (callback: () => void) => {
        mocks.change = callback;
        return { dispose: mocks.subscriptionDispose };
      },
    });
  });
  it("同步代码、语言和主题，卸载时释放编辑器及模型", async () => {
    const wrapper = mount(CodeEditor, {
      props: { modelValue: "const n = 1", language: "js" },
      global: { stubs: { "a-button": true } },
    });
    await flushPromises();
    expect(mocks.createModel).toHaveBeenCalledWith("const n = 1", "javascript");
    expect(mocks.create).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ theme: "vs", automaticLayout: true }),
    );
    useThemeStore().setToggleDark(true);
    await wrapper.setProps({ language: "ts", modelValue: "let n = 2" });
    expect(mocks.setTheme).toHaveBeenCalledWith("vs-dark");
    expect(mocks.setModelLanguage).toHaveBeenCalledWith(
      expect.anything(),
      "typescript",
    );
    expect(mocks.value).toBe("let n = 2");
    mocks.value = "let n = 3";
    mocks.change();
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["let n = 3"]);
    await wrapper.setProps({ language: "unknown-language" });
    expect(mocks.setModelLanguage).toHaveBeenLastCalledWith(
      expect.anything(),
      "plaintext",
    );
    wrapper.unmount();
    expect(mocks.editorDispose).toHaveBeenCalledOnce();
    expect(mocks.modelDispose).toHaveBeenCalledOnce();
    expect(mocks.subscriptionDispose).toHaveBeenCalledOnce();
  });
});
