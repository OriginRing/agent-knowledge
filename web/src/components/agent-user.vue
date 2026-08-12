<template>
  <div class="agent-user">
    <a-dropdown
      placement="topLeft"
      trigger="click"
      overlay-class-name="app-user-menu"
    >
      <template #overlay>
        <a-menu>
          <a-menu-item @click="openProfile">
            <a-flex align="center" gap="small">
              <a-avatar :size="18" :src="user.avatar || undefined">
                <template #icon><UserOutlined /></template>
              </a-avatar>
              个人信息
            </a-flex>
          </a-menu-item>
          <a-menu-item @click="openBackgroundPicker">
            <a-flex align="center" justify="space-between">
              <a-flex align="center" gap="small">
                <SkinOutlined />
                主题
              </a-flex>
              <span
                class="theme-switch-control"
                @click.stop
                @mousedown.stop
                @keydown.stop
              >
                <a-switch
                  v-model:checked="themeSwitch"
                  size="small"
                  aria-label="切换明暗主题"
                  @change="changeTheme"
                >
                  <template #checkedChildren>
                    <Iconfont type="icon-sunyardsun" />
                  </template>
                  <template #unCheckedChildren>
                    <Iconfont type="icon-sunyarddark" />
                  </template>
                </a-switch>
              </span>
            </a-flex>
          </a-menu-item>
          <a-menu-item @click.stop="remove">
            <a-flex align="center" gap="small">
              <LogoutOutlined />
              退出登录
            </a-flex>
          </a-menu-item>
        </a-menu>
      </template>
      <button
        class="agent-use-info"
        type="button"
        :disabled="!chatService.getTokenStatus"
        aria-label="查看用户资料"
      >
        <a-avatar :size="36" :src="user.avatar || undefined">
          <template #icon><UserOutlined /></template>
        </a-avatar>
        <div v-if="chatService.getTokenStatus" class="user-name">
          {{ user.nickname || user.username }}
        </div>
        <div v-else class="user-name">未登录</div>
        <SettingOutlined />
      </button>
    </a-dropdown>
  </div>

  <a-modal
    v-model:open="profileOpen"
    width="560px"
    :title="editing ? '编辑用户资料' : '用户资料'"
    :mask-closable="!saving"
    destroy-on-close
  >
    <a-descriptions v-if="!editing" :column="1" bordered size="small">
      <a-descriptions-item label="头像">
        <a-avatar :size="52" :src="user.avatar || undefined">
          <template #icon><UserOutlined /></template>
        </a-avatar>
      </a-descriptions-item>
      <a-descriptions-item label="用户名">
        {{ user.username }}
        <a-tag color="processing" style="margin-left: 8px">
          {{ user.role === "admin" ? "管理员" : "用户" }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="昵称">{{
        user.nickname || "未设置"
      }}</a-descriptions-item>
      <a-descriptions-item label="性别">{{
        genderLabel(user.gender)
      }}</a-descriptions-item>
      <a-descriptions-item label="年龄">{{
        user.age ?? "未设置"
      }}</a-descriptions-item>
      <a-descriptions-item label="长期记忆">
        <a-tag :color="user.memory ? 'success' : 'default'">
          {{ user.memory ? "已开启" : "未开启" }}
        </a-tag>
      </a-descriptions-item>
      <a-descriptions-item label="注册时间">{{
        user.created_at
      }}</a-descriptions-item>
    </a-descriptions>

    <a-form
      v-else
      ref="profileFormRef"
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
      <a-flex gap="16">
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
    </a-form>

    <template #footer>
      <a-flex justify="end" gap="8">
        <a-button @click="profileOpen = false">关闭</a-button>
        <a-button v-if="!editing" type="primary" @click="beginEdit"
          >编辑</a-button
        >
        <template v-else>
          <a-button @click="editing = false">取消编辑</a-button>
          <a-button type="primary" :loading="saving" @click="saveProfile">
            保存
          </a-button>
        </template>
      </a-flex>
    </template>
  </a-modal>

  <BackgroundPickerModal v-model:open="backgroundPickerOpen" />
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watchEffect } from "vue";
import {
  UploadOutlined,
  UserOutlined,
  SettingOutlined,
  SkinOutlined,
  LogoutOutlined,
} from "@ant-design/icons-vue";
import { message, type FormInstance } from "ant-design-vue";
import { clearChatStore, useChatStore } from "@view/stores/chat";
import httpClient from "@view/services/http";
import type { UserInterface } from "@view/interfaces/user-interface";
import { validatePasswordChange } from "@view/utils/profile";
import Iconfont from "@view/components/iconfont.vue";
import BackgroundPickerModal from "@view/components/background-picker-modal.vue";
import { useThemeStore } from "@view/stores/theme";

const chatService = useChatStore();
const themeService = useThemeStore();
const user = ref<Partial<UserInterface>>({});
const profileOpen = ref(false);
const backgroundPickerOpen = ref(false);
const editing = ref(false);
const saving = ref(false);
const avatarUploading = ref(false);
const profileFormRef = ref<FormInstance>();
const themeSwitch = ref(true);

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

const changeTheme = () => {
  themeService.setToggleDark(!themeSwitch.value);
};

const openBackgroundPicker = () => {
  backgroundPickerOpen.value = true;
};

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

const openProfile = () => {
  if (!chatService.getTokenStatus) return;
  editing.value = false;
  resetForm();
  profileOpen.value = true;
};

const beginEdit = () => {
  resetForm();
  editing.value = true;
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

const remove = async () => {
  const res = await httpClient.get("/auth/logout");
  if (res.code === 0) clearChatStore();
};

watchEffect(() => {
  user.value = chatService.getUserDetail;
});

onMounted(() => {
  themeSwitch.value = !themeService.getToggleDark;
});
</script>

<style scoped lang="less">
.agent-user {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.agent-use-info {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 5px 8px;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
  color: inherit;
  background: transparent;
  border-radius: 15px;
  cursor: pointer;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    background 180ms ease;

  &:not(:disabled):hover {
    border-color: var(--app-border-subtle);
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }

  &:disabled {
    cursor: default;
    opacity: 0.68;
  }

  :deep(.ant-avatar) {
    color: var(--app-primary);
    background: var(--app-primary-soft);
  }
}
.user-name {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.half-field {
  flex: 1;
}
.memory-help {
  margin-left: 12px;
}

.theme-switch-control {
  display: inline-flex;
  align-items: center;
}

:deep(.ant-descriptions-view) {
  overflow: hidden;
  border-radius: 16px;
}

:deep(.ant-input-number) {
  min-height: 44px;
  border-color: var(--app-border);
  border-radius: var(--app-radius-control);
  background: var(--app-surface-solid);
}

:global(.app-user-menu .ant-dropdown-menu) {
  min-width: 210px;
  padding: 8px;
  border: 1px solid var(--app-border-subtle);
  border-radius: 18px;
  background: var(--app-surface-solid);
  box-shadow: var(--app-shadow-float);
}

:global(.app-user-menu .ant-dropdown-menu-item) {
  min-height: 44px;
  border-radius: 12px;
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition-duration: 0.01ms !important;
  }
}
</style>
