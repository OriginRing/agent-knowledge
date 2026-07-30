import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { clearChatStore, useChatStore } from "./chat";

describe("chat store history state", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("refreshes history and selects the completed session", () => {
    const chatStore = useChatStore();

    expect(chatStore.getHistoryRefreshVersion).toBe(0);
    expect(chatStore.getActiveHistorySessionId).toBe("");

    chatStore.refreshHistory("session-1");

    expect(chatStore.getHistoryRefreshVersion).toBe(1);
    expect(chatStore.getActiveHistorySessionId).toBe("session-1");
  });

  it("updates and clears the active history session", () => {
    const chatStore = useChatStore();

    chatStore.setActiveHistorySession("session-2");
    expect(chatStore.getActiveHistorySessionId).toBe("session-2");

    clearChatStore();
    expect(chatStore.getActiveHistorySessionId).toBe("");
  });
});
