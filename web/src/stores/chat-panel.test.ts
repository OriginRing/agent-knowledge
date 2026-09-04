// @vitest-environment happy-dom
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { useChatStore, clearChatStore } from "./chat";
import type {
  AgentDetail,
  KnowledgeDoc,
} from "@view/interfaces/agent-interface";
import { openGeneratedFilePreview } from "@view/utils/thought-chain";

describe("工作面板切换", () => {
  beforeEach(() => setActivePinia(createPinia()));
  it("编辑代码自动打开右侧面板，切换文件后返回仍保留草稿", () => {
    const chat = useChatStore();
    const source = { id: "block-a", code: "original", language: "js" };
    chat.openCodeEditor(source);
    expect(chat.agentPreview).toBe(true);
    expect(chat.agentTool).toBe(false);
    expect(chat.panelMode).toBe("code");
    chat.codeDraft!.code = "edited";
    chat.setAgentPreviewFile(new File(["text"], "test.txt"));
    expect(chat.panelMode).toBe("file");
    chat.setAgentPreviewFiles([]);
    expect(chat.panelMode).toBe("references");
    chat.setAgentPreview(false);
    chat.openCodeEditor(source);
    expect(chat.codeDraft!.code).toBe("edited");
    chat.openCodeEditor({ id: "block-b", code: "other", language: "py" });
    expect(chat.codeDraft).toEqual({
      id: "block-b",
      code: "other",
      language: "py",
    });
    clearChatStore();
    expect(chat.codeDraft).toBeNull();
    expect(chat.agentPreview).toBe(false);
  });
  it.each(["agent", "new", "history"])(
    "切换 %s 时关闭并清空所有面板内容",
    (kind) => {
      const chat = useChatStore();
      chat.setAgentDetail({ agentCode: "a" } as AgentDetail);
      chat.setNewConversation("one");
      chat.setActiveHistorySession("one");
      chat.setAgentPreviewFiles([{ fileId: "doc" } as KnowledgeDoc]);
      chat.setAgentPreviewFile(new File(["old"], "old.txt"));
      chat.openCodeEditor({ id: "code", code: "old", language: "js" });
      if (kind === "agent")
        chat.setAgentDetail({ agentCode: "b" } as AgentDetail);
      if (kind === "new") chat.setNewConversation("two");
      if (kind === "history") chat.setActiveHistorySession("two");
      expect(chat.agentPreview).toBe(false);
      expect(chat.agentPreviewFiles).toEqual([]);
      expect(chat.agentPreviewFile).toBeNull();
      expect(chat.codeDraft).toBeNull();
      expect(chat.panelMode).toBe("references");
    },
  );
  it("重复设置同一对话或回答完成刷新历史时保留面板", () => {
    const chat = useChatStore();
    chat.setAgentDetail({ agentCode: "a" } as AgentDetail);
    chat.setNewConversation("one");
    chat.setActiveHistorySession("one");
    chat.openCodeEditor({ id: "code", code: "draft", language: "js" });
    chat.setAgentDetail({ agentCode: "a" } as AgentDetail);
    chat.setNewConversation("one");
    chat.setActiveHistorySession("one");
    chat.refreshHistory("one");
    expect(chat.agentPreview).toBe(true);
    expect(chat.codeDraft?.code).toBe("draft");
  });
  it("切换对话后旧文件请求完成不会重新打开面板", async () => {
    const chat = useChatStore();
    let resolve!: (response: Response) => void;
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    const pending = openGeneratedFilePreview(
      { fileUrl: "/old.txt", fileName: "old.txt" },
      chat,
      (() => response) as typeof fetch,
    );
    chat.setNewConversation("new-session");
    resolve(new Response("old"));
    await pending;
    expect(chat.agentPreview).toBe(false);
    expect(chat.agentPreviewFile).toBeNull();
  });
  it("参考资料打开的文件关闭后返回原列表，再次关闭才隐藏面板", () => {
    const chat = useChatStore();
    const docs = [{ fileId: "doc", fileName: "报告.txt" } as KnowledgeDoc];
    chat.setAgentPreviewFiles(docs);
    chat.setAgentPreview(true);
    chat.setAgentPreviewFile(new File(["内容"], "报告.txt"), "references");
    chat.closeWorkspacePanel();
    expect(chat.agentPreview).toBe(true);
    expect(chat.panelMode).toBe("references");
    expect(chat.agentPreviewFiles).toEqual(docs);
    expect(chat.agentPreviewFile).toBeNull();
    expect(chat.previewFileSource).toBeNull();
    chat.closeWorkspacePanel();
    expect(chat.agentPreview).toBe(false);
  });
  it("直接打开的文件即使有旧参考资料也直接关闭面板", () => {
    const chat = useChatStore();
    chat.setAgentPreviewFiles([{ fileId: "old" } as KnowledgeDoc]);
    chat.setAgentPreviewFile(new File(["old"], "old.txt"), "references");
    chat.setAgentPreviewFile(new File(["new"], "new.txt"));
    chat.setAgentPreview(true);
    chat.closeWorkspacePanel();
    expect(chat.agentPreview).toBe(false);
  });
});
