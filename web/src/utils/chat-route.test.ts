import { describe, expect, it } from "vitest";
import type { AgentDetail } from "@view/interfaces/agent-interface";
import {
  createChatLocation,
  getChatQueryValue,
  isHistoryForChatRoute,
  resolveChatAgent,
} from "./chat-route";

const agents = [
  { agentCode: "writer", default: true },
  { agentCode: "analyst", default: false },
] as AgentDetail[];

describe("chat route", () => {
  it("builds the chat query with the requested public parameter names", () => {
    expect(createChatLocation("writer", "session-1")).toEqual({
      path: "/chat",
      query: { agendCode: "writer", session: "session-1" },
    });
  });

  it("omits an empty session for a new conversation", () => {
    expect(createChatLocation("writer")).toEqual({
      path: "/chat",
      query: { agendCode: "writer" },
    });
  });

  it("normalizes repeated and empty query values", () => {
    expect(getChatQueryValue([" writer ", "analyst"])).toBe("writer");
    expect(getChatQueryValue(null)).toBe("");
  });

  it("uses the requested agent and falls back when it is missing or invalid", () => {
    expect(resolveChatAgent(agents, "analyst")).toEqual({
      agent: agents[1],
      invalid: false,
    });
    expect(resolveChatAgent(agents, "")).toEqual({
      agent: agents[0],
      invalid: false,
    });
    expect(resolveChatAgent(agents, "missing")).toEqual({
      agent: agents[0],
      invalid: true,
    });
  });

  it("only restores a session owned by the selected agent", () => {
    expect(
      isHistoryForChatRoute(
        { session_id: "session-1", agent_code: "writer" },
        "session-1",
        "writer",
      ),
    ).toBe(true);
    expect(
      isHistoryForChatRoute(
        { session_id: "session-1", agent_code: "analyst" },
        "session-1",
        "writer",
      ),
    ).toBe(false);
  });
});
