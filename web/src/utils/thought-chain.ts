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
  "web-search": "联网搜索",
  "knowledge-search": "知识库检索",
  "artifact-generator": "文件生成",
  "sales-performance": "销售业绩查询",
  "chart-visualization": "图表可视化",
};

export const getSkillDisplayName = (skill: string): string =>
  SKILL_LABELS[skill] ?? skill;

const WORKFLOW_NODE_LABELS: Record<string, string> = {
  start: "开始",
  model: "模型",
  condition: "条件分支",
  end: "结束",
};

export const getWorkflowNodeTitle = (node: ChatNode): string => {
  const title = node.summary || node.title;
  if (node.kind === "skill") {
    const automaticTitle =
      !title ||
      title === node.id ||
      title === node.name ||
      /^skill-[a-z0-9]+$/i.test(title);
    if (!automaticTitle) return title;
    const skillName = node.name && node.name !== node.id ? node.name : title;
    if (
      !skillName ||
      skillName === node.id ||
      /^skill-[a-z0-9]+$/i.test(skillName)
    )
      return "Skill";
    return getSkillDisplayName(skillName);
  }
  if (!title || title === node.id || title === node.name) {
    return WORKFLOW_NODE_LABELS[node.name] ?? title ?? "工作流节点";
  }
  return WORKFLOW_NODE_LABELS[title] ?? title;
};

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
  panelResetVersion?: number;
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
  file: string | ParsedFileDetail | GeneratedFileDetail,
): file is GeneratedFileDetail =>
  typeof file === "object" && file !== null && "fileUrl" in file;

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
  const panelVersion = store.panelResetVersion;
  const response = await fetcher(file.fileUrl);
  if (!response.ok) {
    throw new Error(`文件资源获取失败（${response.status}）`);
  }
  const blob = await response.blob();
  const preview = new File([blob], file.fileName, {
    type: blob.type || file.mimeType,
  });
  if (store.panelResetVersion !== panelVersion) return preview;
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

/** Workflow nodes wrap their result in output; legacy history stores it directly. */
export const getNodeDisplayDetails = (node: ChatNode): ChatNode["details"] => {
  const details = node.details ?? {};
  const output: unknown = details.output;
  return output !== null && typeof output === "object" && !Array.isArray(output)
    ? { ...output, ...details }
    : details;
};
