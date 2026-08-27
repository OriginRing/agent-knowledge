import type { LocationQueryValue, RouteLocationRaw } from "vue-router";
import type { AgentDetail } from "@view/interfaces/agent-interface";

export const CHAT_PATH = "/chat";

export const getChatQueryValue = (
  value: LocationQueryValue | LocationQueryValue[],
) => {
  const normalized = Array.isArray(value) ? value[0] : value;
  return typeof normalized === "string" ? normalized.trim() : "";
};

export const createChatLocation = (
  agentCode?: string,
  sessionId?: string,
): RouteLocationRaw => ({
  path: CHAT_PATH,
  query: {
    ...(agentCode ? { agendCode: agentCode } : {}),
    ...(sessionId ? { session: sessionId } : {}),
  },
});

export const resolveChatAgent = (
  agents: AgentDetail[],
  requestedAgentCode: string,
) => {
  const defaultAgent = agents.find((item) => item.default) || agents[0];
  const requestedAgent = agents.find(
    (item) => item.agentCode === requestedAgentCode,
  );
  return {
    agent: requestedAgent || defaultAgent,
    invalid: Boolean(requestedAgentCode && !requestedAgent),
  };
};

export const isHistoryForChatRoute = (
  history: { session_id?: string; agent_code?: string } | undefined,
  sessionId: string,
  agentCode: string,
) => history?.session_id === sessionId && history?.agent_code === agentCode;
