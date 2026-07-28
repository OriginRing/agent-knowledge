export interface HistoryInterface {
  agent_code: string;
  created_at: string;
  id: string;
  preview: string;
  content: string;
  record_count: number;
  session_id: string;
  updated_at: string;
  records: HistorySessionInterface[];
}

export interface HistorySessionInterface {
  key: string;
  role: string;
  content: string;
  thinkMessage?: string;
  agentCode?: string;
  timestamp?: string;
  files?: string;
  nodes?: import("./agent-interface").ChatNode[];
  artifacts?: import("./agent-interface").ChatArtifact[];
  knowledge?: import("./agent-interface").KnowledgeDoc[];
  skills?: string[];
  status?: "running" | "complete" | "error" | "cancelled";
  complete?: boolean;
  error?: string | null;
}
