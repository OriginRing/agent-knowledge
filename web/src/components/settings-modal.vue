<template>
  <a-modal
    v-model:open="open"
    width="900px"
    wrap-class-name="app-settings-modal"
    :footer="null"
    :mask-closable="!saving"
    destroy-on-close
  >
    <div class="settings-layout">
      <aside class="settings-sidebar">
        <h2>设置</h2>
        <nav class="settings-nav" aria-label="设置分类" role="tablist">
          <button
            id="settings-account-tab"
            class="settings-nav-item"
            :class="{ active: activeSetting === 'account' }"
            type="button"
            role="tab"
            aria-controls="settings-account-panel"
            :aria-selected="activeSetting === 'account'"
            @click="selectSetting('account')"
          >
            <UserOutlined />
            <span>账号</span>
          </button>
          <button
            id="settings-theme-tab"
            class="settings-nav-item"
            :class="{ active: activeSetting === 'theme' }"
            type="button"
            role="tab"
            aria-controls="settings-theme-panel"
            :aria-selected="activeSetting === 'theme'"
            @click="selectSetting('theme')"
          >
            <SkinOutlined />
            <span>主题</span>
          </button>
        </nav>
      </aside>

      <main class="settings-content">
        <section
          v-if="activeSetting === 'account'"
          id="settings-account-panel"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-account-tab"
        >
          <header class="settings-content-header">
            <div>
              <h3>账号</h3>
              <p>查看并管理你的个人资料与账号安全。</p>
            </div>
            <a-button v-if="!editing" type="primary" @click="beginEdit">
              编辑资料
            </a-button>
          </header>

          <div class="settings-scroll-area">
            <div v-if="!editing" class="account-summary">
              <div class="account-identity">
                <a-avatar :size="72" :src="user.avatar || undefined">
                  <template #icon><UserOutlined /></template>
                </a-avatar>
                <div>
                  <strong>{{ user.nickname || user.username }}</strong>
                  <span>@{{ user.username }}</span>
                </div>
                <a-tag color="processing">
                  {{ user.role === "admin" ? "管理员" : "用户" }}
                </a-tag>
              </div>
              <a-descriptions :column="1" bordered size="small">
                <a-descriptions-item label="昵称">
                  {{ user.nickname || "未设置" }}
                </a-descriptions-item>
                <a-descriptions-item label="性别">
                  {{ genderLabel(user.gender) }}
                </a-descriptions-item>
                <a-descriptions-item label="年龄">
                  {{ user.age ?? "未设置" }}
                </a-descriptions-item>
                <a-descriptions-item label="长期记忆">
                  <a-tag :color="user.memory ? 'success' : 'default'">
                    {{ user.memory ? "已开启" : "未开启" }}
                  </a-tag>
                </a-descriptions-item>
                <a-descriptions-item label="注册时间">
                  {{ user.created_at }}
                </a-descriptions-item>
              </a-descriptions>
            </div>

            <a-form
              v-else
              ref="profileFormRef"
              class="account-form"
              :model="form"
              :rules="profileRules"
              layout="vertical"
            >
              <a-form-item label="头像">
                <a-flex align="center" gap="16">
                  <a-avatar :size="64" :src="form.avatar || undefined">
                    <template #icon><UserOutlined /></template>
                  </a-avatar>
                  <a-upload
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    :show-upload-list="false"
                    :before-upload="uploadAvatar"
                  >
                    <a-button :loading="avatarUploading">
                      <UploadOutlined />
                      上传头像
                    </a-button>
                  </a-upload>
                </a-flex>
              </a-form-item>
              <a-form-item label="用户名">
                <a-input :value="user.username" disabled />
              </a-form-item>
              <a-form-item label="昵称" name="nickname">
                <a-input v-model:value="form.nickname" :maxlength="100" />
              </a-form-item>
              <a-flex class="form-row" gap="16">
                <a-form-item label="性别" name="gender" class="half-field">
                  <a-select
                    v-model:value="form.gender"
                    allow-clear
                    placeholder="请选择"
                  >
                    <a-select-option :value="0">女</a-select-option>
                    <a-select-option :value="1">男</a-select-option>
                  </a-select>
                </a-form-item>
                <a-form-item label="年龄" name="age" class="half-field">
                  <a-input-number
                    v-model:value="form.age"
                    :min="0"
                    :max="150"
                    style="width: 100%"
                  />
                </a-form-item>
              </a-flex>
              <a-form-item label="长期记忆">
                <a-switch v-model:checked="form.memory" />
                <a-typography-text type="secondary" class="memory-help">
                  开启后，聊天会检索并写入与当前用户相关的长期记忆。
                </a-typography-text>
              </a-form-item>

              <a-divider orientation="left">修改密码（可选）</a-divider>
              <a-form-item label="当前密码" name="currentPassword">
                <a-input-password
                  v-model:value="form.currentPassword"
                  autocomplete="current-password"
                />
              </a-form-item>
              <a-form-item label="新密码" name="newPassword">
                <a-input-password
                  v-model:value="form.newPassword"
                  autocomplete="new-password"
                />
              </a-form-item>
              <a-form-item label="确认新密码" name="confirmPassword">
                <a-input-password
                  v-model:value="form.confirmPassword"
                  autocomplete="new-password"
                />
              </a-form-item>
              <a-flex class="account-form-actions" justify="end" gap="8">
                <a-button @click="cancelEdit">取消</a-button>
                <a-button type="primary" :loading="saving" @click="saveProfile">
                  保存
                </a-button>
              </a-flex>
            </a-form>
          </div>
        </section>

        <section
          v-else
          id="settings-theme-panel"
          class="settings-panel"
          role="tabpanel"
          aria-labelledby="settings-theme-tab"
        >
          <header class="settings-content-header">
            <div>
              <h3>主题</h3>
              <p>选择界面外观与聊天页面背景，设置会立即生效。</p>
            </div>
          </header>

          <div class="settings-scroll-area">
            <div class="theme-section">
              <div class="theme-section-heading">
                <strong>外观模式</strong>
                <span>选择更适合当前环境的界面亮度。</span>
              </div>
              <div class="theme-mode-options" aria-label="外观模式">
                <button
                  class="theme-mode-option"
                  :class="{ selected: !themeService.getToggleDark }"
                  type="button"
                  :aria-pressed="!themeService.getToggleDark"
                  @click="setThemeMode(false)"
                >
                  <span class="theme-preview theme-preview-light">
                    <span></span><span></span><span></span>
                  </span>
                  <span class="theme-mode-label">
                    <span>浅色模式</span>
                    <CheckCircleFilled
                      v-if="!themeService.getToggleDark"
                      aria-hidden="true"
                    />
                  </span>
                </button>
                <button
                  class="theme-mode-option"
                  :class="{ selected: themeService.getToggleDark }"
                  type="button"
                  :aria-pressed="themeService.getToggleDark"
                  @click="setThemeMode(true)"
                >
                  <span class="theme-preview theme-preview-dark">
                    <span></span><span></span><span></span>
                  </span>
                  <span class="theme-mode-label">
                    <span>深色模式</span>
                    <CheckCircleFilled
                      v-if="themeService.getToggleDark"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </div>
            </div>

            <div class="theme-section">
              <div class="theme-section-heading theme-background-heading">
                <div>
                  <strong>页面背景</strong>
                  <span>背景仅改变页面氛围，不影响文字清晰度。</span>
                </div>
                <a-button
                  :disabled="!themeService.backgroundImageId"
                  @click="selectBackground('')"
                >
                  恢复默认
                </a-button>
              </div>
              <div class="background-grid" aria-label="可用背景图片">
                <button
                  v-for="image in backgroundImages"
                  :key="image.id"
                  class="background-option"
                  :class="{
                    selected: themeService.backgroundImageId === image.id,
                  }"
                  type="button"
                  :aria-label="`使用背景 ${image.name}`"
                  :aria-pressed="themeService.backgroundImageId === image.id"
                  @click="selectBackground(image.id)"
                >
                  <img
                    :src="image.url"
                    :alt="`${image.name} 背景预览`"
                    loading="lazy"
                  />
                  <span class="background-option-label">
                    <span>{{ image.name }}</span>
                    <CheckCircleFilled
                      v-if="themeService.backgroundImageId === image.id"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              </div>
              <a-empty
                v-if="backgroundImages.length === 0"
                description="暂无可用背景图片"
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref, watch, watchEffect } from "vue";
import {
  CheckCircleFilled,
  SkinOutlined,
  UploadOutlined,
  UserOutlined,
} from "@ant-design/icons-vue";
import { message, type FormInstance } from "ant-design-vue";
import { useChatStore } from "@view/stores/chat";
import httpClient from "@view/services/http";
import type { UserInterface } from "@view/interfaces/user-interface";
import { validatePasswordChange } from "@view/utils/profile";
import { backgroundImages, useThemeStore } from "@view/stores/theme";

type SettingKey = "account" | "theme";

const open = defineModel<boolean>("open", { required: true });
const chatService = useChatStore();
const themeService = useThemeStore();
const user = ref<Partial<UserInterface>>({});
const activeSetting = ref<SettingKey>("account");
const editing = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const profileFormRef = ref<FormInstance>();

const form = reactive({
  avatar: "",
  nickname: "",
  gender: undefined as number | undefined,
  age: undefined as number | undefined,
  memory: false,
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const validatePassword = async () => {
  const error = validatePasswordChange(form);
  if (error) throw new Error(error);
};

const profileRules = {
  nickname: [{ max: 100, message: "昵称不能超过 100 个字符", trigger: "blur" }],
  age: [
    {
      type: "number",
      min: 0,
      max: 150,
      message: "年龄需在 0 到 150 之间",
      trigger: "blur",
    },
  ],
};

const genderLabel = (gender?: number | null) =>
  gender === 0 ? "女" : gender === 1 ? "男" : "未设置";

const resetForm = () => {
  form.avatar = user.value.avatar ?? "";
  form.nickname = user.value.nickname ?? "";
  form.gender = user.value.gender ?? undefined;
  form.age = user.value.age ?? undefined;
  form.memory = Boolean(user.value.memory);
  form.currentPassword = "";
  form.newPassword = "";
  form.confirmPassword = "";
};

const selectSetting = (setting: SettingKey) => {
  activeSetting.value = setting;
};

const beginEdit = () => {
  resetForm();
  editing.value = true;
};

const cancelEdit = () => {
  editing.value = false;
  resetForm();
};

const setThemeMode = (isDark: boolean) => {
  themeService.setToggleDark(isDark);
};

const selectBackground = (imageId: string) => {
  themeService.setBackgroundImage(imageId);
};

const uploadAvatar = async (file: File) => {
  if (file.size / 1024 / 1024 >= 5) {
    message.error("头像图片不能超过 5MB");
    return false;
  }
  avatarUploading.value = true;
  const data = new FormData();
  data.append("file", file);
  try {
    const result = await httpClient.post("/file/upload", data);
    if (result.code !== 0) throw new Error(result.message);
    form.avatar = result.data.url;
    message.success("头像上传成功");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "头像上传失败");
  } finally {
    avatarUploading.value = false;
  }
  return false;
};

const saveProfile = async () => {
  try {
    await profileFormRef.value?.validate();
    await validatePassword();
    saving.value = true;
    const profileResult = await httpClient.patch<UserInterface>(
      "/auth/userinfo",
      {
        avatar: form.avatar || null,
        nickname: form.nickname || null,
        gender: form.gender ?? null,
        age: form.age ?? null,
        memory: form.memory,
      },
    );
    if (profileResult.code !== 0) throw new Error(profileResult.message);
    chatService.setUserDetail(profileResult.data);
    if (form.currentPassword || form.newPassword || form.confirmPassword) {
      const passwordResult = await httpClient.put("/auth/password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (passwordResult.code !== 0) throw new Error(passwordResult.message);
    }
    user.value = profileResult.data;
    editing.value = false;
    resetForm();
    message.success("用户资料已更新");
  } catch (error) {
    message.error(error instanceof Error ? error.message : "用户资料保存失败");
  } finally {
    saving.value = false;
  }
};

watchEffect(() => {
  user.value = chatService.getUserDetail;
});

watch(open, (isOpen) => {
  if (!isOpen) return;
  activeSetting.value = "account";
  editing.value = false;
  resetForm();
});
</script>

<style scoped lang="less">
.settings-layout {
  min-height: min(680px, 78vh);
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
}

.settings-sidebar {
  padding: 32px 20px;
  border-right: 1px solid var(--app-border-subtle);
  background: var(--app-surface-soft);

  h2 {
    margin: 0 12px 28px;
    color: var(--app-text);
    font-size: 24px;
    font-weight: 760;
    letter-spacing: -0.02em;
  }
}

.settings-nav {
  display: grid;
  gap: 8px;
}

.settings-nav-item {
  min-height: 48px;
  padding: 0 14px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: 14px;
  color: var(--app-text-secondary);
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  font-weight: 650;
  text-align: left;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;

  .anticon {
    font-size: 18px;
  }

  &:hover {
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }

  &.active {
    border-color: var(--app-accent-border, var(--app-border));
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }
}

.settings-content {
  max-height: min(680px, 78vh);
  padding-top: 38px;
  overflow: hidden;
  color: var(--app-text);
  background: var(--app-surface-solid);
}

.settings-panel {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.settings-content-header {
  flex: none;
  min-height: 68px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
  padding: 0 72px 0 44px;

  h3 {
    margin: 0 0 6px;
    color: var(--app-text);
    font-size: 24px;
    font-weight: 760;
    letter-spacing: -0.02em;
  }

  p {
    margin: 0;
    color: var(--app-text-secondary);
    line-height: 1.6;
  }
}

.settings-scroll-area {
  min-height: 0;
  flex: 1;
  padding: 0 44px 44px;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.account-summary,
.account-form,
.theme-section {
  padding: 24px;
  border: 1px solid var(--app-border-subtle);
  border-radius: var(--app-radius-card);
  background: var(--app-surface-soft);
}

.account-identity {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;

  > div {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 3px;
  }

  strong {
    overflow: hidden;
    color: var(--app-text);
    font-size: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    overflow: hidden;
    color: var(--app-text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.half-field {
  flex: 1;
}

.memory-help {
  margin-left: 12px;
}

.account-form-actions {
  padding-top: 8px;
}

.theme-section + .theme-section {
  margin-top: 20px;
}

.theme-section-heading {
  display: grid;
  gap: 4px;
  margin-bottom: 18px;

  strong {
    color: var(--app-text);
    font-size: 16px;
  }

  span {
    color: var(--app-text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }
}

.theme-background-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  > div {
    display: grid;
    gap: 4px;
  }
}

.theme-mode-options,
.background-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.theme-mode-option,
.background-option {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  border: 2px solid transparent;
  border-radius: 16px;
  color: var(--app-text);
  background: var(--app-surface-solid);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease,
    transform 180ms ease;

  &:hover {
    border-color: var(--app-accent-border, var(--app-border));
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--app-primary);
    box-shadow: var(--app-focus);
  }
}

.theme-preview {
  height: 92px;
  display: grid;
  grid-template-columns: 34% 1fr;
  grid-template-rows: 26px 1fr;
  gap: 8px;
  padding: 12px;

  span {
    display: block;
    border-radius: 8px;
  }

  span:first-child {
    grid-row: 1 / 3;
  }

  span:nth-child(2) {
    border-radius: 999px;
  }
}

.theme-preview-light {
  background: #f3f2fa;

  span {
    background: #ffffff;
  }

  span:nth-child(2) {
    background: #dcd8fa;
  }
}

.theme-preview-dark {
  background: #1c1a2b;

  span {
    background: #2f2c45;
  }

  span:nth-child(2) {
    background: #7167e8;
  }
}

.theme-mode-label,
.background-option-label {
  min-height: 48px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-weight: 650;

  .anticon {
    flex: none;
    color: var(--app-primary);
  }
}

.background-option img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

:deep(.ant-descriptions-view) {
  overflow: hidden;
  border-radius: 14px;
}

:deep(.ant-input-number) {
  min-height: 44px;
  border-color: var(--app-border);
  border-radius: var(--app-radius-control);
  background: var(--app-surface-solid);
}

:global(.app-settings-modal .ant-modal) {
  max-width: calc(100vw - 48px);
  padding-bottom: 0;
}

:global(.app-settings-modal .ant-modal-content) {
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--app-border-subtle);
  border-radius: 24px;
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-float);
}

:global(.app-settings-modal .ant-modal-close) {
  top: 18px;
  right: 18px;
  width: 44px;
  height: 44px;
  color: var(--app-text-secondary);
}

@media (max-width: 768px) {
  .settings-layout {
    min-height: min(720px, 84vh);
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .settings-sidebar {
    padding: 20px 56px 12px 16px;
    border-right: 0;
    border-bottom: 1px solid var(--app-border-subtle);

    h2 {
      margin: 0 0 14px;
      font-size: 20px;
    }
  }

  .settings-nav {
    display: flex;
  }

  .settings-nav-item {
    min-height: 44px;
    flex: 1;
    justify-content: center;
  }

  .settings-content {
    max-height: none;
    padding-top: 24px;
  }

  .settings-content-header {
    padding: 0 16px;
  }

  .settings-scroll-area {
    padding: 0 16px 32px;
  }

  .theme-mode-options,
  .background-grid {
    grid-template-columns: 1fr;
  }

  .form-row {
    flex-direction: column;
    gap: 0 !important;
  }

  .memory-help {
    display: block;
    margin: 8px 0 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
  }
}
</style>
