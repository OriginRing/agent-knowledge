import { defineStore } from "pinia";
import type {
  AgentDetail,
  KnowledgeDoc,
} from "@view/interfaces/agent-interface";
import type { HistorySessionInterface } from "@view/interfaces/history-interface";
import type { UserInterface } from "@view/interfaces/user-interface";

interface AgentChat {
  tokenStatus: boolean;
  userDetail: UserInterface;
  agentList: AgentDetail[];
  agentDetail: AgentDetail;
  newConversation: string;
  agentTool: boolean;
  agentHistoryDetail: HistorySessionInterface[];
  agentPreview: boolean;
  agentPreviewFiles: KnowledgeDoc[];
  agentKnowledgeFile: File | null;
}

export const useChatStore = defineStore("chatPiniaService", {
  state: (): AgentChat => ({
    tokenStatus: true,
    userDetail: {} as UserInterface,
    agentList: [],
    agentDetail: {} as AgentDetail,
    newConversation: "",
    agentTool: true,
    agentHistoryDetail: [],
    agentPreview: false,
    agentPreviewFiles: [],
    agentKnowledgeFile: null,
  }),

  getters: {
    getTokenStatus: (state: AgentChat) => state.tokenStatus,
    getUserDetail: (state: AgentChat) => state.userDetail,
    getAgentDetail: (state: AgentChat) => state.agentDetail,
    getAgentList: (state: AgentChat) => state.agentList,
    getNewConversation: (state: AgentChat) => state.newConversation,
    getAgentTool: (state: AgentChat) => state.agentTool,
    getAgentHistoryDetail: (state: AgentChat) => state.agentHistoryDetail,
    getAgentPreview: (state: AgentChat) => state.agentPreview,
    getAgentPreviewFiles: (state: AgentChat) => state.agentPreviewFiles,
    getAgentKnowledgeFile: (state: AgentChat) => state.agentKnowledgeFile,
  },

  actions: {
    setTokenStatus(status: boolean) {
      this.tokenStatus = status;
    },
    setUserDetail(user: UserInterface) {
      this.userDetail = user;
    },
    setAgentDetail(detail: AgentDetail) {
      this.agentDetail = detail;
    },
    setAgentList(list: AgentDetail[]) {
      this.agentList = list;
    },
    setNewConversation(now: string) {
      this.newConversation = now;
    },
    setAgentTool(visible: boolean) {
      this.agentTool = visible;
    },
    setAgentHistoryDetail(detail: HistorySessionInterface[]) {
      this.agentHistoryDetail = detail;
    },
    setAgentPreview(preview: boolean) {
      this.agentPreview = preview;
    },
    setAgentPreviewFiles(files: KnowledgeDoc[]) {
      this.agentPreviewFiles = files;
    },
    setAgentKnowledgeFile(file: File | null) {
      this.agentKnowledgeFile = file;
    },
  },
});

export const clearChatStore = () => {
  useChatStore().setUserDetail({} as UserInterface);
  useChatStore().setAgentHistoryDetail([]);
  useChatStore().setAgentList([]);
  useChatStore().setAgentDetail({} as AgentDetail);
  useChatStore().setTokenStatus(false);
  useChatStore().setAgentPreview(false);
  useChatStore().setAgentPreviewFiles([]);
  useChatStore().setAgentKnowledgeFile(null);
};
