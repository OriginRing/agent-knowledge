import { describe, expect, it } from "vitest";
import type { ChatNode } from "@view/interfaces/agent-interface";
import {
  formatThoughtDuration,
  getNodeDisplayDetails,
  getGeneratedFiles,
  getSkillDisplayName,
  getThoughtChainLabel,
  getWorkflowNodeTitle,
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

  it("工作流节点显示配置名称和 Skill 名称，不暴露画布 ID", () => {
    expect(
      getWorkflowNodeTitle({
        ...fileNode(),
        id: "skill-mahq77g",
        kind: "skill",
        name: "web-search",
        title: "web-search",
        summary: "web-search",
      }),
    ).toBe("联网搜索");
    expect(
      getWorkflowNodeTitle({
        ...fileNode(),
        id: "skill-mahq77g",
        kind: "skill",
        name: "web-search",
        title: "查询公开资料",
        summary: "查询公开资料",
      }),
    ).toBe("查询公开资料");
    expect(
      getWorkflowNodeTitle({
        ...fileNode(),
        id: "model-fwv4k8c",
        kind: "model",
        name: "model",
        title: "model-fwv4k8c",
        summary: "model-fwv4k8c",
      }),
    ).toBe("模型");
    expect(
      getWorkflowNodeTitle({
        ...fileNode(),
        id: "model-fwv4k8c",
        kind: "model",
        name: "model",
        title: "总结结论",
        summary: "总结结论",
      }),
    ).toBe("总结结论");
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

describe("工作流节点输出兼容", () => {
  it("解包搜索结果并保留结构化输出和执行信息", () => {
    const output = {
      context: "实时资料",
      items: [{ title: "来源", url: "https://example.com" }],
    };
    const node = fileNode({
      kind: "skill",
      details: { output, elapsedMs: 25 },
    });
    expect(getNodeDisplayDetails(node)).toEqual({
      ...output,
      output,
      elapsedMs: 25,
    });
  });
  it("兼容历史直接字段、跳过原因和原始类型输出", () => {
    const legacy = fileNode({ details: { context: "历史资料" } });
    expect(getNodeDisplayDetails(legacy)).toEqual(legacy.details);
    expect(
      getNodeDisplayDetails(
        fileNode({
          details: { output: { status: "skipped", reason: "未开启联网" } },
        }),
      ).reason,
    ).toBe("未开启联网");
    expect(
      getNodeDisplayDetails(fileNode({ details: { output: false } })).output,
    ).toBe(false);
  });
});
