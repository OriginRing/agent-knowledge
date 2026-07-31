<template>
  <a-modal
    v-model:open="open"
    :closable="false"
    :mask-closable="false"
    :keyboard="false"
    :footer="null"
    :width="920"
    centered
    wrap-class-name="auth-modal"
    :style="authTokenStyle"
  >
    <div class="auth-shell">
      <section class="mascot-panel" aria-hidden="true">
        <div class="brand">
          <span class="brand-mark">
            <svg viewBox="0 0 24 24">
              <path d="M7 7.5h10M8.5 4.5h7M6 11.5h12v7H6z" />
              <path d="M9 15h.01M15 15h.01M12 2.5v2" />
            </svg>
          </span>
          <span>Agent Knowledge</span>
        </div>

        <div
          class="mascot"
          :class="{
            'is-watching': activeField === 'username',
            'is-hiding': mascotHiding,
          }"
        >
          <svg class="mascot-svg" viewBox="0 0 360 310">
            <path
              class="mascot-shadow"
              d="M73 270c17-22 195-26 216 0 19 24-24 31-108 31-87 0-125-9-108-31Z"
            />
            <path class="ear" d="M91 83C58 60 48 105 75 124l29-8Z" />
            <path class="ear" d="M269 83c33-23 43 22 16 41l-29-8Z" />
            <path class="ear-inner" d="M84 91c-14-8-19 10-6 19l13 1Z" />
            <path class="ear-inner" d="M276 91c14-8 19 10 6 19l-13 1Z" />
            <path
              class="body"
              d="M103 207c23-23 130-23 154 0 16 16 24 58 10 71-17 16-158 16-175 0-14-13-5-55 11-71Z"
            />
            <path
              class="head"
              d="M82 123c0-58 38-94 98-94s98 36 98 94c0 69-41 112-98 112S82 192 82 123Z"
            />
            <path
              class="face-patch"
              d="M118 132c2-41 25-62 62-62s60 21 62 62c3 51-24 81-62 81s-65-30-62-81Z"
            />

            <g class="eyes-open">
              <ellipse class="eye-white" cx="151" cy="126" rx="17" ry="20" />
              <ellipse class="eye-white" cx="209" cy="126" rx="17" ry="20" />
              <g
                class="pupils"
                :style="{ transform: `translateX(${eyeOffset}px)` }"
              >
                <circle class="pupil" cx="151" cy="128" r="8" />
                <circle class="pupil" cx="209" cy="128" r="8" />
                <circle class="eye-glint" cx="148" cy="124" r="2.5" />
                <circle class="eye-glint" cx="206" cy="124" r="2.5" />
              </g>
            </g>
            <g class="eyes-closed">
              <path d="M136 128q15 15 30 0" />
              <path d="M194 128q15 15 30 0" />
            </g>

            <ellipse class="muzzle" cx="180" cy="169" rx="35" ry="27" />
            <path class="nose" d="M168 160q12-9 24 0-2 14-12 14t-12-14Z" />
            <path
              class="smile"
              d="M180 173v8m0 0q-13 12-23 0m23 0q13 12 23 0"
            />
            <path class="cheek" d="M126 161h-13m134 0h-13" />

            <g class="mascot-paws">
              <g class="mascot-paw paw-left">
                <path
                  class="paw-shape"
                  d="M97 230c-17-4-24-19-15-32 8-12 22-23 38-34 13-9 29 8 20 21-11 16-23 31-43 45Z"
                />
                <path class="paw-line" d="M93 207l17 8m-11-17 17 9" />
              </g>
              <g class="mascot-paw paw-right">
                <path
                  class="paw-shape"
                  d="M263 230c17-4 24-19 15-32-8-12-22-23-38-34-13-9-29 8-20 21 11 16 23 31 43 45Z"
                />
                <path class="paw-line" d="M267 207l-17 8m11-17-17 9" />
              </g>
            </g>
          </svg>
        </div>

        <div class="mascot-copy">
          <p class="eyebrow">你的智能知识伙伴</p>
          <h2>{{ mascotTitle }}</h2>
          <p>{{ mascotDescription }}</p>
        </div>
        <span class="shape shape-one"></span>
        <span class="shape shape-two"></span>
        <span class="shape shape-three"></span>
      </section>

      <section class="form-panel">
        <a-tooltip
          :title="themeStore.isDark ? '切换到浅色主题' : '切换到深色主题'"
        >
          <button
            type="button"
            class="theme-toggle"
            :aria-label="
              themeStore.isDark ? '切换到浅色主题' : '切换到深色主题'
            "
            @click="toggleTheme"
          >
            <BulbFilled v-if="themeStore.isDark" />
            <BulbOutlined v-else />
          </button>
        </a-tooltip>

        <div class="form-content">
          <div class="mobile-brand">
            <span class="brand-mark">
              <svg viewBox="0 0 24 24">
                <path d="M7 7.5h10M8.5 4.5h7M6 11.5h12v7H6z" />
                <path d="M9 15h.01M15 15h.01M12 2.5v2" />
              </svg>
            </span>
            Agent Knowledge
          </div>

          <transition name="form-swap" mode="out-in">
            <div :key="loginCard ? 'login' : 'register'">
              <header class="form-header">
                <span class="welcome-tag">{{
                  loginCard ? "欢迎回来" : "创建新账户"
                }}</span>
                <h1>{{ loginCard ? "登录账户" : "加入我们" }}</h1>
                <p>
                  {{
                    loginCard
                      ? "继续探索你的智能知识空间"
                      : "只需几步，即刻开启智能知识之旅"
                  }}
                </p>
              </header>

              <a-form
                v-if="loginCard"
                ref="loginFormRef"
                :model="formState"
                :rules="loginRules"
                layout="vertical"
                class="auth-form"
                @finish="handleLogin"
              >
                <a-form-item label="账号" name="username">
                  <a-input
                    v-model:value="formState.username"
                    size="large"
                    inputmode="numeric"
                    autocomplete="username"
                    :maxlength="20"
                    placeholder="请输入数字账号"
                    @focus="activeField = 'username'"
                    @blur="activeField = null"
                  >
                    <template #prefix>
                      <UserOutlined />
                    </template>
                  </a-input>
                </a-form-item>

                <a-form-item label="密码" name="password">
                  <a-input-password
                    v-model:value="formState.password"
                    v-model:visible="loginPasswordVisible"
                    size="large"
                    autocomplete="current-password"
                    placeholder="请输入密码"
                    @focus="activeField = 'loginPassword'"
                    @blur="activeField = null"
                  >
                    <template #prefix>
                      <LockOutlined />
                    </template>
                  </a-input-password>
                </a-form-item>

                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  block
                  class="submit-button"
                  :loading="loading"
                >
                  {{ loading ? "正在登录" : "登录" }}
                </a-button>
              </a-form>

              <a-form
                v-else
                ref="registerFormRef"
                :model="formRegister"
                :rules="registerRules"
                layout="vertical"
                class="auth-form"
                @finish="registerUser"
              >
                <div class="field-grid">
                  <a-form-item label="账号" name="username">
                    <a-input
                      v-model:value="formRegister.username"
                      size="large"
                      inputmode="numeric"
                      autocomplete="username"
                      :maxlength="20"
                      placeholder="请输入数字账号"
                      @focus="activeField = 'username'"
                      @blur="activeField = null"
                    >
                      <template #prefix><UserOutlined /></template>
                    </a-input>
                  </a-form-item>
                  <a-form-item label="昵称" name="nickname">
                    <a-input
                      v-model:value.trim="formRegister.nickname"
                      size="large"
                      autocomplete="nickname"
                      :maxlength="20"
                      placeholder="大家怎么称呼你"
                    >
                      <template #prefix><SmileOutlined /></template>
                    </a-input>
                  </a-form-item>
                </div>

                <a-form-item label="密码" name="password">
                  <a-input-password
                    v-model:value="formRegister.password"
                    v-model:visible="registerPasswordVisible"
                    size="large"
                    autocomplete="new-password"
                    placeholder="至少 6 位"
                    @focus="activeField = 'registerPassword'"
                    @blur="activeField = null"
                  >
                    <template #prefix><LockOutlined /></template>
                  </a-input-password>
                </a-form-item>

                <a-form-item label="确认密码" name="confirmPassword">
                  <a-input-password
                    v-model:value="formRegister.confirmPassword"
                    v-model:visible="confirmPasswordVisible"
                    size="large"
                    autocomplete="new-password"
                    placeholder="请再次输入密码"
                    @focus="activeField = 'confirmPassword'"
                    @blur="activeField = null"
                  >
                    <template #prefix><SafetyOutlined /></template>
                  </a-input-password>
                </a-form-item>

                <a-button
                  type="primary"
                  html-type="submit"
                  size="large"
                  block
                  class="submit-button"
                  :loading="loading"
                >
                  {{ loading ? "正在创建" : "创建账户" }}
                </a-button>
              </a-form>

              <p class="switch-copy">
                {{ loginCard ? "还没有账户？" : "已经有账户？" }}
                <button
                  type="button"
                  class="switch-button"
                  :disabled="loading"
                  @click="checkType(!loginCard)"
                >
                  {{ loginCard ? "立即注册" : "返回登录" }}
                </button>
              </p>
            </div>
          </transition>
        </div>
      </section>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from "vue";
import type { FormInstance, Rule } from "ant-design-vue/es/form";
import { message, theme } from "ant-design-vue";
import {
  BulbFilled,
  BulbOutlined,
  LockOutlined,
  SafetyOutlined,
  SmileOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import httpClient from "@view/services/http";
import { useChatStore } from "@view/stores/chat";
import { useThemeStore } from "@view/stores/theme";

type ActiveField =
  | "username"
  | "loginPassword"
  | "registerPassword"
  | "confirmPassword"
  | null;

const open = ref(false);
const loading = ref(false);
const loginCard = ref(true);
const activeField = ref<ActiveField>(null);
const loginPasswordVisible = ref(false);
const registerPasswordVisible = ref(false);
const confirmPasswordVisible = ref(false);
const loginFormRef = ref<FormInstance>();
const registerFormRef = ref<FormInstance>();
const chatService = useChatStore();
const themeStore = useThemeStore();

const { useToken } = theme;
const { token } = useToken();

const authTokenStyle = computed(() => ({
  "--auth-primary": token.value.colorPrimary,
  "--auth-primary-hover": token.value.colorPrimaryHover,
  "--auth-primary-active": token.value.colorPrimaryActive,
  "--auth-primary-bg": token.value.colorPrimaryBg,
  "--auth-primary-bg-hover": token.value.colorPrimaryBgHover,
  "--auth-primary-border": token.value.colorPrimaryBorder,
  "--auth-primary-border-hover": token.value.colorPrimaryBorderHover,
  "--auth-primary-text": token.value.colorPrimaryText,
  "--auth-bg": token.value.colorBgElevated,
  "--auth-bg-container": token.value.colorBgContainer,
  "--auth-text": token.value.colorText,
  "--auth-text-secondary": token.value.colorTextSecondary,
  "--auth-border": token.value.colorBorder,
  "--auth-fill-secondary": token.value.colorFillSecondary,
  "--auth-fill-tertiary": token.value.colorFillTertiary,
  "--auth-error": token.value.colorError,
  "--auth-on-primary": token.value.colorTextLightSolid,
  "--auth-shadow": token.value.boxShadowSecondary,
  "--mascot-face": token.value.colorTextLightSolid,
  "--mascot-pupil": "#1f1f1f",
}));

const formState = reactive({
  username: "",
  password: "",
});

const formRegister = reactive({
  username: "",
  password: "",
  confirmPassword: "",
  nickname: "",
});

const usernameValue = computed(() =>
  loginCard.value ? formState.username : formRegister.username,
);

const eyeOffset = computed(() => {
  if (activeField.value !== "username") return 0;
  return Math.min(9, 5 + usernameValue.value.length * 1.5);
});

const isPasswordFieldActive = computed(
  () => activeField.value !== null && activeField.value !== "username",
);

const activePasswordVisible = computed(() => {
  if (activeField.value === "loginPassword") return loginPasswordVisible.value;
  if (activeField.value === "registerPassword") {
    return registerPasswordVisible.value;
  }
  if (activeField.value === "confirmPassword") {
    return confirmPasswordVisible.value;
  }
  return false;
});

const mascotHiding = computed(
  () => isPasswordFieldActive.value && !activePasswordVisible.value,
);

const mascotTitle = computed(() => {
  if (isPasswordFieldActive.value && activePasswordVisible.value) {
    return "密码已显示";
  }
  if (mascotHiding.value) return "放心，我不偷看";
  if (activeField.value === "username") return "正在认识你";
  return loginCard.value ? "很高兴再见到你" : "欢迎新伙伴";
});

const mascotDescription = computed(() => {
  if (isPasswordFieldActive.value && activePasswordVisible.value) {
    return "已为你睁开眼睛，点击图标可以再次隐藏密码。";
  }
  if (mascotHiding.value) return "你的密码只属于你，安心输入吧。";
  if (activeField.value === "username") return "眼睛会跟着你的输入一起移动。";
  return "整理知识、连接灵感，让每次探索都有迹可循。";
});

const toggleTheme = () => {
  themeStore.setToggleDark(!themeStore.isDark);
};

const usernameRules: Rule[] = [
  { required: true, message: "请输入账号", trigger: "blur" },
  {
    pattern: /^\d+$/,
    message: "账号只能包含数字",
    trigger: ["blur", "change"],
  },
];

const nicknameRules: Rule[] = [
  { required: true, message: "请输入昵称", trigger: "blur" },
];

const loginRules: Record<string, Rule[]> = {
  username: usernameRules,
  password: [{ required: true, message: "请输入密码", trigger: "blur" }],
};

const validateConfirmPassword = async (_rule: Rule, value: string) => {
  if (!value) throw new Error("请再次输入密码");
  if (value !== formRegister.password) throw new Error("两次输入的密码不一致");
};

const registerRules: Record<string, Rule[]> = {
  username: usernameRules,
  nickname: nicknameRules,
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码至少需要 6 位", trigger: ["blur", "change"] },
  ],
  confirmPassword: [
    { validator: validateConfirmPassword, trigger: ["blur", "change"] },
  ],
};

const checkType = (showLogin: boolean) => {
  loginCard.value = showLogin;
  activeField.value = null;
  loginPasswordVisible.value = false;
  registerPasswordVisible.value = false;
  confirmPasswordVisible.value = false;
  loginFormRef.value?.clearValidate();
  registerFormRef.value?.clearValidate();
};

const handleLogin = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await httpClient.post("/auth/login", {
      username: formState.username,
      password: formState.password,
    });
    if (res.code !== 0) {
      message.error(res.message || "登录失败，请检查账号和密码");
      return;
    }
    message.success("登录成功，欢迎回来");
    open.value = false;
    window.location.href = "/";
  } catch {
    message.error("网络连接失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

const registerUser = async () => {
  if (loading.value) return;
  loading.value = true;
  try {
    const res = await httpClient.post("/auth/register", {
      username: formRegister.username,
      password: formRegister.password,
      nickname: formRegister.nickname || null,
      avatar: null,
      gender: null,
    });
    if (res.code !== 0) {
      message.error(res.message || "注册失败，请稍后重试");
      return;
    }

    formState.username = formRegister.username;
    formState.password = "";
    loginCard.value = true;
    activeField.value = null;
    message.success("注册成功，请登录");
  } catch {
    message.error("网络连接失败，请稍后重试");
  } finally {
    loading.value = false;
  }
};

watchEffect(() => {
  open.value = !chatService.getTokenStatus;
});
</script>

<style scoped lang="less">
:global(.auth-modal .ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border-radius: 28px;
  background: var(--auth-bg);
  box-shadow: var(--auth-shadow);
}

:global(.auth-modal .ant-modal-body) {
  padding: 0;
}

.auth-shell {
  display: grid;
  grid-template-columns: minmax(330px, 0.92fr) minmax(420px, 1.08fr);
  min-height: 620px;
  color: var(--auth-text);
  background: var(--auth-bg);
}

.mascot-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 34px 38px 32px;
  background: var(--auth-primary-bg);
  color: var(--auth-text);
}

.brand,
.mobile-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand {
  position: relative;
  z-index: 2;
  font-size: 17px;
}

.brand-mark {
  display: inline-grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 11px;
  color: var(--auth-on-primary);
  background: var(--auth-primary);

  svg {
    width: 23px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
}

.mascot {
  position: relative;
  z-index: 2;
  width: min(100%, 360px);
  margin: auto auto 0;
}

.mascot-svg {
  display: block;
  width: 100%;
  overflow: visible;
}

.mascot-shadow {
  fill: var(--auth-fill-secondary);
}

.head,
.ear,
.body,
.paw-shape {
  fill: var(--auth-primary);
  stroke: var(--auth-primary-active);
  stroke-width: 4;
  stroke-linejoin: round;
}

.ear-inner {
  fill: var(--auth-primary-border);
}

.face-patch,
.muzzle {
  fill: var(--mascot-face);
}

.eye-white {
  fill: var(--mascot-face);
  stroke: var(--auth-primary-border-hover);
  stroke-width: 3;
}

.pupils {
  transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.pupil,
.nose {
  fill: var(--mascot-pupil);
}

.eye-glint {
  fill: var(--mascot-face);
}

.eyes-closed {
  opacity: 0;

  path {
    fill: none;
    stroke: var(--mascot-pupil);
    stroke-width: 5;
    stroke-linecap: round;
  }
}

.smile,
.cheek,
.paw-line {
  fill: none;
  stroke: var(--auth-primary-text);
  stroke-width: 3;
  stroke-linecap: round;
}

.mascot-paw {
  transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-box: view-box;
}

.mascot-paw.paw-left {
  transform: translate(-20px, 38px) rotate(-20deg);
  transform-origin: 113px 224px;
}

.mascot-paw.paw-right {
  transform: translate(20px, 38px) rotate(20deg);
  transform-origin: 247px 224px;
}

.eyes-open,
.eyes-closed {
  transition:
    opacity 180ms ease,
    transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mascot.is-watching .head {
  animation: curious-tilt 1.8s ease-in-out infinite alternate;
  transform-origin: 180px 160px;
}

.mascot.is-hiding {
  .eyes-open {
    opacity: 0;
  }

  .eyes-closed {
    opacity: 1;
  }

  .mascot-paw {
    transform: translate(0) rotate(0);
  }
}

.mascot-copy {
  position: relative;
  z-index: 2;
  min-height: 118px;
  text-align: center;

  .eyebrow {
    margin-bottom: 8px;
    color: var(--auth-primary-text);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.14em;
  }

  h2 {
    margin-bottom: 10px;
    color: var(--auth-text);
    font-size: 25px;
    line-height: 1.2;
    letter-spacing: -0.04em;
  }

  p:last-child {
    max-width: 300px;
    margin: 0 auto;
    color: var(--auth-text-secondary);
    font-size: 14px;
    line-height: 1.7;
  }
}

.shape {
  position: absolute;
  border-radius: 999px;
  background: var(--auth-primary-bg-hover);
}

.shape-one {
  top: -45px;
  right: -75px;
  width: 180px;
  height: 180px;
}

.shape-two {
  bottom: 88px;
  left: -55px;
  width: 130px;
  height: 130px;
}

.shape-three {
  top: 90px;
  left: 40px;
  width: 14px;
  height: 14px;
  box-shadow:
    270px 65px 0 6px var(--auth-primary-border),
    26px 190px 0 3px var(--auth-primary-bg-hover);
}

.form-panel {
  position: relative;
  display: grid;
  min-width: 0;
  place-items: center;
  padding: 42px 54px;
  background: var(--auth-bg);
}

.theme-toggle {
  position: absolute;
  z-index: 3;
  top: 24px;
  right: 24px;
  display: grid;
  width: 44px;
  height: 44px;
  padding: 0;
  place-items: center;
  border: 1px solid var(--auth-border);
  border-radius: 50%;
  color: var(--auth-text-secondary);
  background: var(--auth-fill-tertiary);
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: var(--auth-primary-border-hover);
    color: var(--auth-primary-text);
    background: var(--auth-primary-bg-hover);
  }

  &:active {
    transform: scale(0.94);
  }

  &:focus-visible {
    outline: 3px solid var(--auth-primary-border);
    outline-offset: 2px;
  }
}

.form-content {
  width: 100%;
  max-width: 410px;
}

.mobile-brand {
  display: none;
  margin-bottom: 28px;
  color: var(--auth-text);
}

.form-header {
  margin-bottom: 30px;

  .welcome-tag {
    display: inline-block;
    margin-bottom: 10px;
    color: var(--auth-primary);
    font-size: 13px;
    font-weight: 700;
  }

  h1 {
    margin-bottom: 10px;
    color: var(--auth-text);
    font-size: clamp(28px, 3vw, 36px);
    line-height: 1.15;
    letter-spacing: -0.045em;
  }

  p {
    color: var(--auth-text-secondary);
    font-size: 14px;
    line-height: 1.6;
  }
}

.auth-form {
  width: 100%;

  :deep(.ant-form-item) {
    margin-bottom: 20px;
  }

  :deep(.ant-form-item-label) {
    padding-bottom: 7px;
  }

  :deep(.ant-form-item-label > label) {
    height: auto;
    color: var(--auth-text);
    font-size: 14px;
    font-weight: 650;
  }

  :deep(.ant-input-affix-wrapper) {
    min-height: 48px;
    padding-inline: 14px;
    border-color: var(--auth-border);
    border-radius: 12px;
    box-shadow: none;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease,
      background 180ms ease;

    &:hover {
      border-color: var(--auth-primary-border-hover);
    }

    &:focus,
    &-focused {
      border-color: var(--auth-primary);
      box-shadow: 0 0 0 3px var(--auth-primary-bg-hover);
    }
  }

  :deep(.ant-input-prefix) {
    margin-inline-end: 10px;
    color: var(--auth-text-secondary);
  }

  :deep(.ant-form-item-explain-error) {
    padding-top: 3px;
    font-size: 12px;
  }
}

.field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}

.submit-button {
  min-height: 50px;
  margin-top: 4px;
  border: 0;
  border-radius: 12px;
  font-weight: 700;
  background: var(--auth-primary);
  box-shadow: var(--auth-shadow);
  transition:
    background 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:not(:disabled):hover {
    background: var(--auth-primary-hover);
    box-shadow: var(--auth-shadow);
    transform: translateY(-1px);
  }

  &:not(:disabled):active {
    transform: translateY(0);
  }
}

.switch-copy {
  margin-top: 24px;
  color: var(--auth-text-secondary);
  font-size: 14px;
  text-align: center;
}

.switch-button {
  min-width: 72px;
  min-height: 44px;
  margin: -12px -10px -12px 0;
  padding: 0 10px;
  border: 0;
  color: var(--auth-primary);
  font: inherit;
  font-weight: 700;
  background: transparent;
  cursor: pointer;

  &:hover {
    color: var(--auth-primary-hover);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  &:focus-visible {
    border-radius: 8px;
    outline: 3px solid var(--auth-primary-border);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.form-swap-enter-active,
.form-swap-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.form-swap-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.form-swap-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

@keyframes curious-tilt {
  from {
    transform: rotate(-1.5deg);
  }
  to {
    transform: rotate(1.5deg);
  }
}

@media (max-width: 760px) {
  :global(.auth-modal) {
    padding: 16px;
  }

  :global(.auth-modal .ant-modal) {
    width: min(100%, 520px) !important;
    max-width: 100%;
    margin: 0 auto;
    padding-bottom: 0;
  }

  .auth-shell {
    display: block;
    min-height: 0;
  }

  .mascot-panel {
    display: none;
  }

  .form-panel {
    min-height: min(650px, calc(100dvh - 32px));
    padding: 34px 26px;
  }

  .theme-toggle {
    top: 22px;
    right: 22px;
  }

  .mobile-brand {
    display: flex;
  }
}

@media (max-width: 430px) {
  .form-panel {
    padding: 28px 20px;
  }

  .field-grid {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .form-header {
    margin-bottom: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mascot *,
  .form-swap-enter-active,
  .form-swap-leave-active,
  .submit-button {
    animation: none !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
