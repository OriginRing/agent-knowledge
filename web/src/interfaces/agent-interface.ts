import { SafeAny } from "@view/interfaces/safe-any-interface";

export interface AgentDetail {
  agentCode: string;
  agentName: string;
  description: string;
  id: number;
  model_type: string;
  status: number;
  default: boolean;
  supportConnect: boolean;
  supportDownload: boolean;
  supportFile: boolean;
  supportKnowledge: boolean;
  supportThink: boolean;
}

export interface AgentChat {
  key: string;
  role: "user" | "system" | "assistant";
  content: string;
  files?: string;
  question?: string;
  loading?: boolean;
  thinking?: boolean;
  knowledgeSkill?: boolean;
  connectSkill?: boolean;
  knowledge?: KnowledgeDoc[];
  thinkMessage?: string;
  complete?: boolean;
  collapse?: string;
  typing?: boolean;
  signal?: AbortController;
  nodes?: ChatNode[];
  artifacts?: ChatArtifact[];
  skills?: string[];
  status?: "running" | "complete" | "error" | "cancelled";
  error?: string | null;
  createdAt?: string;
  finishedAt?: string;
}

export type ChatNodeStatus =
  | "pending"
  | "running"
  | "success"
  | "error"
  | "skipped";

export interface ParsedFileDetail {
  url: string;
  filename: string;
  extension: string;
  isImage: boolean;
  content: string;
  charCount: number;
  status: "success" | "error";
  error?: string | null;
}

export interface ChatNode {
  id: string;
  kind:
    | "pipeline"
    | "skill"
    | "model"
    | "memory"
    | "history"
    | "artifact"
    | "file";
  name: string;
  title: string;
  summary: string;
  status: ChatNodeStatus;
  fileUrl?: string;
  details: {
    files?: Array<ParsedFileDetail | GeneratedFileDetail>;
    items?: Array<Record<string, SafeAny>>;
    query?: string;
    context?: string;
    reasoning?: string;
    skills?: string[];
    errors?: Array<{ format?: string; error: string }>;
    error?: string;
    [key: string]: SafeAny;
  };
  startedAt?: string;
  finishedAt?: string;
}

export interface GeneratedFileDetail {
  fileUrl: string;
  fileName: string;
  format: string;
  mimeType: string;
  size: number;
}

export interface ChatArtifact {
  id: string;
  type: "file";
  format: "docx" | "xlsx" | "pptx" | "pdf";
  mimeType: string;
  name: string;
  url: string;
  size: number;
}

export interface KnowledgeDoc {
  fileName: string;
  fileId: string;
  fileContent: string | string[];
  fileUrl: string;
  createdAt: number;
}

export interface Memory {
  memory_detail_list: MemoryDetail[];
  preference_detail_list: MemoryDetail[];
  tool_memory_detail_list: MemoryDetail[];
  total: number;
  size: number;
  current: number;
  pages: number;
}
export interface MemoryDetail {
  id: string;
  memory_key: string;
  memory_value: string;
  memory_type: string;
  create_time: number;
  conversation_id: string;
  status: string;
  confidence: number;
  tags: string[];
  update_time: number;
  info: SafeAny;
  sources: MemorySources[];
}

export interface MemorySources {
  type: string;
  role: string;
  chat_time: string;
  message_id: string;
  content: string;
  lang: string;
}
