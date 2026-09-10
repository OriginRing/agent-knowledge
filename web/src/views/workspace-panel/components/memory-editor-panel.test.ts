// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useChatStore } from "@view/stores/chat";
import MemoryEditorPanel from "./memory-editor-panel.vue";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@view/services/http", () => ({
  default: { post: mocks.post },
}));

vi.mock("ant-design-vue", () => ({
  message: { success: mocks.success, error: mocks.error },
}));

type MemoryPanelVm = {
  memoryInput: string;
  submitMemory: () => Promise<void>;
};

const mountPanel = (conversationId = "") => {
  const pinia = createPinia();
  const chat = useChatStore(pinia);
  chat.setUserDetail({ username: "000001" } as never);
  chat.openMemoryEditor(conversationId);
  const wrapper = mount(MemoryEditorPanel, {
    global: {
      plugins: [pinia],
      stubs: {
        "a-alert": true,
        "a-button": true,
        RichTextEditor: true,
      },
    },
  });
  return { chat, wrapper };
};

describe("右侧记忆编辑面板", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ code: 0 });
  });

  it("在面板内新增记忆并通知页面刷新", async () => {
    const { chat, wrapper } = mountPanel();
    const vm = wrapper.vm as unknown as MemoryPanelVm;
    vm.memoryInput = "  偏好中文\n\n- 回答简洁  ";

    await vm.submitMemory();

    expect(mocks.post).toHaveBeenCalledWith("/auth/memory/add", {
      conversation_id: "000001",
      messages: [{ role: "user", content: "偏好中文\n\n- 回答简洁" }],
    });
    expect(mocks.success).toHaveBeenCalledWith("记忆添加成功");
    expect(chat.memoryRefreshVersion).toBe(1);
    expect(chat.agentPreview).toBe(false);
  });

  it("在面板内保持订正接口契约", async () => {
    const { chat, wrapper } = mountPanel("conversation-1");
    const vm = wrapper.vm as unknown as MemoryPanelVm;
    vm.memoryInput = "准确的订正内容";

    await vm.submitMemory();

    expect(mocks.post).toHaveBeenCalledWith("/auth/memory/update", {
      conversation_id: "conversation-1",
      feedback_content: "准确的订正内容",
    });
    expect(mocks.success).toHaveBeenCalledWith("已对相关记忆进行订正");
    expect(chat.agentPreview).toBe(false);
  });

  it("上传失败时保留内容和右侧面板", async () => {
    mocks.post.mockResolvedValue({ code: 1, message: "服务暂不可用" });
    const { chat, wrapper } = mountPanel();
    const vm = wrapper.vm as unknown as MemoryPanelVm;
    vm.memoryInput = "不要丢失的内容";

    await vm.submitMemory();

    expect(mocks.error).toHaveBeenCalledWith("服务暂不可用");
    expect(vm.memoryInput).toBe("不要丢失的内容");
    expect(chat.agentPreview).toBe(true);
    expect(chat.memoryUploadLoading).toBe(false);
  });

  it("忽略空内容和上传期间的重复提交", async () => {
    const { chat, wrapper } = mountPanel();
    const vm = wrapper.vm as unknown as MemoryPanelVm;

    vm.memoryInput = "   ";
    await vm.submitMemory();
    expect(mocks.post).not.toHaveBeenCalled();

    vm.memoryInput = "有效内容";
    chat.setMemoryUploadLoading(true);
    await vm.submitMemory();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
