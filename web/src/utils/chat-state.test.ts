import { describe, expect, it } from "vitest";
import { rehydrateHistoryMessages } from "./chat-state";
import { validatePasswordChange } from "./profile";

describe("rehydrateHistoryMessages", () => {
  it("恢复历史节点、产物和错误样式状态", () => {
    const messages = rehydrateHistoryMessages([
      {
        key: "assistant-1",
        role: "assistant",
        content: "回答",
        nodes: [
          {
            id: "node-1",
            kind: "skill",
            name: "web_search",
            title: "搜索完成",
            summary: "搜索完成",
            status: "success",
            details: {},
          },
        ],
        artifacts: [
          {
            id: "file-1",
            type: "file",
            format: "pdf",
            mimeType: "application/pdf",
            name: "报告.pdf",
            url: "https://oss.example/report.pdf",
            size: 1024,
          },
        ],
        status: "error",
        error: "部分技能失败",
      },
    ]);
    expect(messages[0].nodes).toHaveLength(2);
    expect(messages[0].nodes?.[1].kind).toBe("file");
    expect(messages[0].nodes?.[1].fileUrl).toBe(
      "https://oss.example/report.pdf",
    );
    expect(messages[0].artifacts).toHaveLength(1);
    expect(messages[0].status).toBe("error");
    expect(messages[0].complete).toBe(true);
  });
});

describe("validatePasswordChange", () => {
  it("允许不修改密码", () => {
    expect(
      validatePasswordChange({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }),
    ).toBeNull();
  });

  it("校验原密码、长度和确认密码", () => {
    expect(
      validatePasswordChange({
        currentPassword: "",
        newPassword: "123456",
        confirmPassword: "123456",
      }),
    ).toBe("请输入当前密码");
    expect(
      validatePasswordChange({
        currentPassword: "old",
        newPassword: "123",
        confirmPassword: "123",
      }),
    ).toBe("新密码至少需要 6 位");
    expect(
      validatePasswordChange({
        currentPassword: "old",
        newPassword: "123456",
        confirmPassword: "654321",
      }),
    ).toBe("两次输入的新密码不一致");
  });
});
