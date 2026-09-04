import { defineStore } from "pinia";
import { ref } from "vue";
export type Kind = "agents" | "workflows" | "skills";
export interface Resource {
  id: string;
  kind: Kind;
  name: string;
  revision: number;
  draft: Record<string, any>;
  publishedVersion: number | null;
  online: boolean;
  agentCount?: number;
}
export async function api<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const value = await response.json();
  if (!response.ok || value.code !== 0) {
    if (response.status === 401)
      window.dispatchEvent(new Event("admin-session-expired"));
    throw new Error(
      typeof value.detail === "string"
        ? value.detail
        : value.message || "请求失败",
    );
  }
  return value.data as T;
}
export const useSession = defineStore("session", () => {
  const username = ref("");
  async function restore() {
    const user = await api("/admin/me");
    username.value = user.username;
  }
  async function login(user: string, password: string) {
    await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: user, password }),
    });
    await restore();
  }
  return { username, restore, login };
});
export const request = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
