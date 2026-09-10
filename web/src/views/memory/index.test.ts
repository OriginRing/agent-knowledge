// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoryPage from "./index.vue";
import { useChatStore } from "@view/stores/chat";

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@view/services/http", () => ({
  default: { post: mocks.post },
}));

vi.mock("ant-design-vue", () => ({
  Empty: { PRESENTED_IMAGE_SIMPLE: "empty" },
  message: { success: mocks.success, error: mocks.error },
}));

vi.mock("@ant-design/icons-vue", () => ({
  ClearOutlined: { template: "<span />" },
  DeleteOutlined: { template: "<span />" },
  FormOutlined: { template: "<span />" },
}));

type MemoryPageVm = {
  openMemory: (conversationId?: string) => void;
};

const mountPage = () => {
  const pinia = createPinia();
  const chat = useChatStore(pinia);
  chat.setUserDetail({ username: "000001" } as never);
  const wrapper = mount(MemoryPage, {
    global: {
      plugins: [pinia],
      stubs: {
        "a-button": true,
        "a-card": true,
        "a-empty": true,
        "a-flex": true,
        "a-input-search": true,
        "a-skeleton": true,
        "a-tag": true,
      },
    },
  });
  return { chat, wrapper };
};

describe("记忆页面打开右侧编辑器", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({
      code: 0,
      data: { data: { memory_detail_list: [] } },
    });
  });

  it("新增按钮只打开右侧记忆面板，不发起上传请求", async () => {
    const { chat, wrapper } = mountPage();
    await flushPromises();

    (wrapper.vm as unknown as MemoryPageVm).openMemory();

    expect(chat.agentPreview).toBe(true);
    expect(chat.panelMode).toBe("memory");
    expect(chat.memoryConversationId).toBe("");
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith("/auth/memory/list", {
      page: 1,
      page_size: 10,
    });
  });

  it("编辑入口把会话编号交给右侧面板", async () => {
    const { chat, wrapper } = mountPage();
    await flushPromises();

    (wrapper.vm as unknown as MemoryPageVm).openMemory("conversation-1");

    expect(chat.panelMode).toBe("memory");
    expect(chat.memoryConversationId).toBe("conversation-1");
  });

  it("面板上传成功后触发页面刷新列表", async () => {
    const { chat, wrapper } = mountPage();
    await flushPromises();
    (wrapper.vm as unknown as MemoryPageVm).openMemory();

    chat.finishMemoryEditor();
    await flushPromises();

    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(chat.agentPreview).toBe(false);
  });
});
