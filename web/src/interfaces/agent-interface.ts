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
