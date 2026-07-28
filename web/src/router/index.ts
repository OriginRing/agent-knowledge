import { createRouter, createWebHistory } from "vue-router";
import type { NavigationGuardNext } from "vue-router";
import httpClient from "@view/services/http";
import { useChatStore } from "@view/stores/chat";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "Chat",
      component: () => import("@view/views/agent-chat/index.vue"),
    },
    {
      path: "/history",
      name: "History",
      component: () => import("@view/views/agent-history/index.vue"),
    },
    {
      path: "/knowledge",
      name: "Knowledge",
      component: () => import("@view/views/knowledge/index.vue"),
    },
    {
      path: "/memory",
      name: "Memory",
      component: () => import("@view/views/memory/index.vue"),
    },
  ],
});

router.beforeEach(async (_to, _from, next: NavigationGuardNext) => {
  try {
    const res = await httpClient.get("/auth/userinfo");
    if (res.code === 0) {
      useChatStore().setTokenStatus(true);
      useChatStore().setUserDetail(res.data);
      next();
    } else {
      useChatStore().setTokenStatus(false);
      next();
    }
  } catch {
    useChatStore().setTokenStatus(false);
    next();
  }
});

export default router;
