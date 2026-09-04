import { defineStore } from "pinia";
import type {
  AgentDetail,
  KnowledgeDoc,
} from "@view/interfaces/agent-interface";
import type { HistorySessionInterface } from "@view/interfaces/history-interface";
import type { UserInterface } from "@view/interfaces/user-interface";

export interface CodeDraft {
  id: string;
  code: string;
  language: string;
}

interface AgentChat {
  previewFileSource: "references" | "direct" | null;
  panelResetVersion: number;
  panelMode: "references" | "file" | "code";
  codeDraft: CodeDraft | null;
  tokenStatus: boolean;
  userDetail: UserInterface;
  agentList: AgentDetail[];
  agentDetail: AgentDetail;
  newConversation: string;
  agentTool: boolean;
  agentHistoryDetail: HistorySessionInterface[];
  agentPreview: boolean;
  agentPreviewFiles: KnowledgeDoc[];
  agentPreviewFile: File | null;
  historyRefreshVersion: number;
  activeHistorySessionId: string;
}

export const useChatStore = defineStore("chatPiniaService", {
  state: (): AgentChat => ({
    previewFileSource: null,
    panelResetVersion: 0,
    panelMode: "references",
    codeDraft: null,
    tokenStatus: true,
    userDetail: {} as UserInterface,
    agentList: [],
    agentDetail: {} as AgentDetail,
    newConversation: "",
    agentTool: true,
    agentHistoryDetail: [],
    agentPreview: false,
    agentPreviewFiles: [],
    agentPreviewFile: null,
    historyRefreshVersion: 0,
    activeHistorySessionId: "",
  }),

  getters: {
    canReturnToReferences: (state: AgentChat) =>
      state.panelMode === "file" && state.previewFileSource === "references",
    getTokenStatus: (state: AgentChat) => state.tokenStatus,
    getUserDetail: (state: AgentChat) => state.userDetail,
    getAgentDetail: (state: AgentChat) => state.agentDetail,
    getAgentList: (state: AgentChat) => state.agentList,
    getNewConversation: (state: AgentChat) => state.newConversation,
    getAgentTool: (state: AgentChat) => state.agentTool,
    getAgentHistoryDetail: (state: AgentChat) => state.agentHistoryDetail,
    getAgentPreview: (state: AgentChat) => state.agentPreview,
    getAgentPreviewFiles: (state: AgentChat) => state.agentPreviewFiles,
    getAgentPreviewFile: (state: AgentChat) => state.agentPreviewFile,
    getHistoryRefreshVersion: (state: AgentChat) => state.historyRefreshVersion,
    getActiveHistorySessionId: (state: AgentChat) =>
      state.activeHistorySessionId,
  },

  actions: {
    closeWorkspacePanel() {
      if (this.canReturnToReferences) {
        this.setAgentPreviewFile(null);
        return;
      }
      this.setAgentPreview(false);
    },
    resetWorkspacePanel() {
      this.previewFileSource = null;
      this.panelResetVersion += 1;
      this.agentPreview = false;
      this.agentPreviewFiles = [];
      this.agentPreviewFile = null;
      this.codeDraft = null;
      this.panelMode = "references";
    },
    setTokenStatus(status: boolean) {
      this.tokenStatus = status;
    },
    setUserDetail(user: UserInterface) {
      this.userDetail = user;
    },
    setAgentDetail(detail: AgentDetail) {
      if (this.agentDetail.agentCode !== detail.agentCode)
        this.resetWorkspacePanel();
      this.agentDetail = detail;
    },
    setAgentList(list: AgentDetail[]) {
      this.agentList = list;
    },
    setNewConversation(now: string) {
      if (this.newConversation !== now) this.resetWorkspacePanel();
      this.newConversation = now;
    },
    setAgentTool(visible: boolean) {
      this.agentTool = visible;
    },
    setAgentHistoryDetail(detail: HistorySessionInterface[]) {
      this.agentHistoryDetail = detail;
    },
    openCodeEditor(draft: CodeDraft) {
      if (this.codeDraft?.id !== draft.id) this.codeDraft = { ...draft };
      this.panelMode = "code";
      this.agentPreview = true;
      this.agentTool = false;
    },
    setAgentPreview(preview: boolean) {
      this.agentPreview = preview;
    },
    setAgentPreviewFiles(files: KnowledgeDoc[]) {
      this.agentPreviewFiles = files;
      this.panelMode = "references";
    },
    setAgentPreviewFile(
      file: File | null,
      source: "references" | "direct" = "direct",
    ) {
      this.previewFileSource = file ? source : null;
      this.agentPreviewFile = file;
      this.panelMode = file ? "file" : "references";
    },
    setActiveHistorySession(sessionId: string) {
      if (this.activeHistorySessionId !== sessionId) this.resetWorkspacePanel();
      this.activeHistorySessionId = sessionId;
    },
    refreshHistory(sessionId: string) {
      this.activeHistorySessionId = sessionId;
      this.historyRefreshVersion += 1;
    },
  },
});

export const clearChatStore = () => {
  useChatStore().resetWorkspacePanel();
  useChatStore().setUserDetail({} as UserInterface);
  useChatStore().setAgentHistoryDetail([]);
  useChatStore().setAgentList([]);
  useChatStore().setAgentDetail({} as AgentDetail);
  useChatStore().setTokenStatus(false);
  useChatStore().setAgentPreview(false);
  useChatStore().setAgentPreviewFiles([]);
  useChatStore().setAgentPreviewFile(null);
  useChatStore().setActiveHistorySession("");
};
