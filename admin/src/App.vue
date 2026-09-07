<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api, useSession } from "./api";
import LoginFlowScene from "./components/LoginFlowScene.vue";
const session = useSession();
const route = useRoute();
const ready = ref(false),
  busy = ref(false),
  error = ref(""),
  user = ref(""),
  password = ref("");
const labels: Record<string, string> = {
  agents: "智能体开发",
  models: "模型管理",
  skills: "Skill 管理",
  workflows: "工作流配置",
  knowledge: "知识库管理",
};
function expired() {
  session.username = "";
}
onMounted(async () => {
  window.addEventListener("admin-session-expired", expired);
  try {
    await session.restore();
  } catch {
    /* show login */
  } finally {
    ready.value = true;
  }
});
onUnmounted(() => window.removeEventListener("admin-session-expired", expired));
async function login() {
  busy.value = true;
  error.value = "";
  try {
    await session.login(user.value, password.value);
    password.value = "";
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
async function logout() {
  await api("/auth/logout");
  expired();
}
</script>
<template>
  <a-config-provider
    :theme="{
      token: {
        colorPrimary: '#6d4aff',
        borderRadius: 8,
        fontFamily: 'system-ui, sans-serif',
      },
    }"
  >
    <div v-if="!ready" class="loading"><a-spin tip="正在恢复会话" /></div>
    <div v-else-if="!session.username" class="login-shell">
      <LoginFlowScene />
      <a-card class="login-card"
        ><h2>登录管理端</h2>
        <p class="muted">使用现有管理员账号继续</p>
        <a-alert v-if="error" type="error" :message="error" show-icon />
        <a-form layout="vertical" :model="{ user, password }" @finish="login">
          <a-form-item label="账号" required
            ><a-input
              v-model:value="user"
              autocomplete="username"
              placeholder="请输入账号"
          /></a-form-item>
          <a-form-item label="密码" required
            ><a-input-password
              v-model:value="password"
              autocomplete="current-password"
              placeholder="请输入密码"
          /></a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            block
            :loading="busy"
            :disabled="!user || !password"
            >登录</a-button
          >
        </a-form>
      </a-card>
    </div>
    <div v-else class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">A</span>
          <div>Agent Studio<small>智能体管理端</small></div>
        </div>
        <span class="nav-caption">开发空间</span>
        <router-link
          v-for="(label, key) in labels"
          :key="key"
          :to="'/' + key"
          :class="{
            active: route.params.kind === key || route.path === '/' + key,
          }"
          ><span class="nav-dot" />{{ label }}</router-link
        >
        <div class="sidebar-footer">
          <span class="avatar">{{ session.username.slice(-2) }}</span>
          <span class="account-name">{{ session.username }}</span>
          <a-button type="text" size="small" @click="logout">退出</a-button>
        </div>
      </aside>
      <main
        :class="{
          'workflow-main': route.params.kind === 'workflows' && route.params.id,
        }"
      >
        <router-view :key="String(route.params.kind)" />
      </main>
    </div>
  </a-config-provider>
</template>
