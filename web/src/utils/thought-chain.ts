import type {
  ChatNode,
  ChatNodeStatus,
  GeneratedFileDetail,
  KnowledgeDoc,
  ParsedFileDetail,
} from "@view/interfaces/agent-interface";
import { upsertChatNode } from "./sse";

export type ThoughtChainStatus = "pending" | "success" | "error";
export type AssistantMessageStatus =
  | "running"
  | "complete"
  | "error"
  | "cancelled";

const SKILL_LABELS: Record<string, string> = {
  "file-reader": "文件读取",
  "image-to-document": "图片生成文档",
  "web-search": "联网搜索",
  "knowledge-search": "知识库检索",
  "artifact-generator": "文件生成",
};

export const getSkillDisplayName = (skill: string): string =>
  SKILL_LABELS[skill] ?? skill;

export const formatThoughtDuration = (milliseconds: number): string =>
  `${(Math.max(0, milliseconds) / 1000).toFixed(1)}s`;

export const getThoughtChainLabel = (
  active: boolean,
  status: AssistantMessageStatus,
  nodeCount: number,
): string => {
  if (active) return nodeCount ? "思考中..." : "开始思考";
  if (status === "error") return "思考遇到问题";
  if (status === "cancelled") return "中断思考";
  return "思考完成";
};

interface FilePreviewStore {
  setAgentPreviewFiles: (files: KnowledgeDoc[]) => void;
  setAgentPreviewFile?: (file: File) => void;
  setAgentKnowledgeFile?: (file: File) => void;
  setAgentTool: (visible: boolean) => void;
  setAgentPreview: (visible: boolean) => void;
}

export const toThoughtChainStatus = (
  status: ChatNodeStatus,
): ThoughtChainStatus => {
  if (status === "error") return "error";
  if (status === "pending" || status === "running") return "pending";
  return "success";
};

const isGeneratedFile = (
  file: ParsedFileDetail | GeneratedFileDetail,
): file is GeneratedFileDetail => "fileUrl" in file;

export const getGeneratedFiles = (node: ChatNode): GeneratedFileDetail[] => {
  const files = (node.details?.files ?? []).filter(isGeneratedFile);
  if (files.length) return files;

  return (node.fileUrl ?? "")
    .split(",")
    .map((fileUrl) => fileUrl.trim())
    .filter(Boolean)
    .map((fileUrl) => {
      const pathName = decodeURIComponent(
        new URL(fileUrl, "http://localhost").pathname.split("/").pop() ??
          "生成文件",
      );
      const format = pathName.includes(".")
        ? pathName.split(".").pop()?.toLowerCase() || ""
        : "";
      return {
        fileUrl,
        fileName: pathName,
        format,
        mimeType: "",
        size: 0,
      };
    });
};

export const mergeReasoningIntoModelNode = (
  nodes: ChatNode[],
  reasoning: string,
): ChatNode[] => {
  const current = nodes.find((node) => node.id === "model-call-1");
  return upsertChatNode(nodes, {
    id: "model-call-1",
    kind: "model",
    name: "model_call",
    title: current?.title || "模型正在思考",
    summary: current?.summary || "模型正在思考",
    status: current?.status === "success" ? "success" : "running",
    details: {
      ...(current?.details ?? {}),
      reasoning,
    },
  });
};

export const openGeneratedFilePreview = async (
  file: GeneratedFileDetail,
  store: FilePreviewStore,
  fetcher: typeof fetch = fetch,
): Promise<File> => {
  const response = await fetcher(file.fileUrl);
  if (!response.ok) {
    throw new Error(`文件资源获取失败（${response.status}）`);
  }
  const blob = await response.blob();
  const preview = new File([blob], file.fileName, {
    type: blob.type || file.mimeType,
  });
  store.setAgentPreviewFiles([]);
  if (store.setAgentPreviewFile) {
    store.setAgentPreviewFile(preview);
  } else if (store.setAgentKnowledgeFile) {
    store.setAgentKnowledgeFile(preview);
  } else {
    throw new Error("文件预览状态未提供文件写入方法");
  }
  store.setAgentTool(false);
  store.setAgentPreview(true);
  return preview;
};
