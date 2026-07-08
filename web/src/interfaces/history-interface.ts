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
  role: string;
  content: string;
  thinkMessage: string;
  agentCode: string;
  key?: string;
  timestamp?: string;
}
