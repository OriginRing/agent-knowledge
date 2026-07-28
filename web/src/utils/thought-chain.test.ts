import { describe, expect, it } from "vitest";
import type { ChatNode } from "@view/interfaces/agent-interface";
import {
  formatThoughtDuration,
  getGeneratedFiles,
  getSkillDisplayName,
  getThoughtChainLabel,
  mergeReasoningIntoModelNode,
  openGeneratedFilePreview,
  toThoughtChainStatus,
} from "./thought-chain";

const fileNode = (overrides: Partial<ChatNode> = {}): ChatNode => ({
  id: "skill-artifact-generator",
  kind: "file",
  name: "artifact_generator",
  title: "生成文件",
  summary: "生成文件",
  status: "success",
  details: {},
  ...overrides,
});

describe("ThoughtChain 节点映射", () => {
  it("生成整链状态文案、技能名称和一位小数计时", () => {
    expect(getThoughtChainLabel(true, "running", 0)).toBe("开始思考");
    expect(getThoughtChainLabel(true, "running", 1)).toBe("思考中...");
    expect(getThoughtChainLabel(false, "complete", 1)).toBe("思考完成");
    expect(getThoughtChainLabel(false, "error", 1)).toBe("思考遇到问题");
    expect(getThoughtChainLabel(false, "cancelled", 1)).toBe("中断思考");
    expect(formatThoughtDuration(2345)).toBe("2.3s");
    expect(getSkillDisplayName("web-search")).toBe("联网搜索");
    expect(getSkillDisplayName("custom-skill")).toBe("custom-skill");
  });

  it("将五种后端状态映射到 ThoughtChain 支持的状态", () => {
    expect(toThoughtChainStatus("pending")).toBe("pending");
    expect(toThoughtChainStatus("running")).toBe("pending");
    expect(toThoughtChainStatus("success")).toBe("success");
    expect(toThoughtChainStatus("error")).toBe("error");
    expect(toThoughtChainStatus("skipped")).toBe("success");
  });

  it("将流式思考合入同一个模型节点", () => {
    const first = mergeReasoningIntoModelNode([], "分析");
    const second = mergeReasoningIntoModelNode(first, "分析完成");
    expect(second).toHaveLength(1);
    expect(second[0].id).toBe("model-call-1");
    expect(second[0].details.reasoning).toBe("分析完成");
  });
});

describe("文件节点", () => {
  it("优先读取 details.files 中的原始文件信息", () => {
    const files = getGeneratedFiles(
      fileNode({
        fileUrl: "https://oss.example/random.pdf",
        details: {
          files: [
            {
              fileUrl: "https://oss.example/random.pdf",
              fileName: "分析报告.pdf",
              format: "pdf",
              mimeType: "application/pdf",
              size: 2048,
            },
          ],
        },
      }),
    );
    expect(files[0].fileName).toBe("分析报告.pdf");
  });

  it("兼容逗号分隔的多个 fileUrl", () => {
    const files = getGeneratedFiles(
      fileNode({
        fileUrl: "https://oss.example/a.docx,https://oss.example/b.pdf",
      }),
    );
    expect(files.map((file) => file.fileName)).toEqual(["a.docx", "b.pdf"]);
  });

  it("预览文件时复用 KnowledgeFile 所需的 Pinia 状态", async () => {
    const state = {
      files: ["old"] as unknown[],
      file: null as File | null,
      tool: true,
      preview: false,
    };
    const store = {
      setAgentPreviewFiles(files: unknown[]) {
        state.files = files;
      },
      setAgentKnowledgeFile(file: File) {
        state.file = file;
      },
      setAgentTool(visible: boolean) {
        state.tool = visible;
      },
      setAgentPreview(visible: boolean) {
        state.preview = visible;
      },
    };
    const fetcher = (async () =>
      new Response(new Blob(["pdf"], { type: "application/pdf" }), {
        status: 200,
      })) as typeof fetch;

    await openGeneratedFilePreview(
      {
        fileUrl: "https://oss.example/report.pdf",
        fileName: "报告.pdf",
        format: "pdf",
        mimeType: "application/pdf",
        size: 3,
      },
      store,
      fetcher,
    );

    expect(state.file?.name).toBe("报告.pdf");
    expect(state.files).toEqual([]);
    expect(state.tool).toBe(false);
    expect(state.preview).toBe(true);
  });
});
