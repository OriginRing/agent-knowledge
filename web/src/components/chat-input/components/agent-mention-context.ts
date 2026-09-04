import type { ComputedRef, InjectionKey, ShallowRef } from "vue";

import type { AgentDetail } from "@view/interfaces/agent-interface";

export interface AgentMentionContext {
  selectedAgent: ComputedRef<AgentDetail | undefined>;
  editorApi: ShallowRef<AgentMentionEditorApi | undefined>;
  clearAgent: () => void;
}

export interface AgentMentionEditorApi {
  insertMention: (agent: AgentDetail, triggerLength: number) => void;
  removeMention: () => void;
  insertSlot: (content: string) => void;
}

export const agentMentionKey: InjectionKey<AgentMentionContext> = Symbol(
  "agent-mention-context",
);
