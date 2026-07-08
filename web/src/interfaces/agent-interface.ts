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
