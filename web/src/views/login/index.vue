<template>
  <a-modal v-model:open="open" :closable="false" :mask-closable="false">
    <template #footer> </template>
    <a-flex v-if="loginCard" vertical align="center" gap="middle">
      <h2>登录</h2>
      <a-form :model="formState">
        <a-form-item label="账号" required>
          <a-input
            v-model:value="formState.username"
            placeholder="Enter your username"
          />
        </a-form-item>
        <a-form-item label="密码" required>
          <a-input-password
            v-model:value="formState.password"
            placeholder="Enter your password"
          />
        </a-form-item>
        <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
          <a-flex justify="center" gap="large">
            <a-button key="cancel" @click="handleCancel"> 重置 </a-button>
            <a-button
              key="submit"
              type="primary"
              :loading="loading"
              @click="handleOk"
            >
              确定
            </a-button>
          </a-flex>
        </a-form-item>
      </a-form>
    </a-flex>
    <a-flex v-else vertical align="center" gap="middle">
      <h2>注册</h2>
      <a-form
        :model="formRegister"
        :label-col="labelCol"
        :wrapper-col="wrapperCol"
      >
        <a-form-item label="账号" required>
          <a-input
            v-model:value="formRegister.username"
            placeholder="Enter your username"
          />
        </a-form-item>
        <a-form-item label="密码" required>
          <a-input-password
            v-model:value="formRegister.password"
            placeholder="Enter your password"
          />
        </a-form-item>
        <a-form-item label="昵称">
          <a-input
            v-model:value="formRegister.nickname"
            placeholder="Enter your password"
          />
        </a-form-item>
        <a-form-item>
          <a-radio-group v-model:value="formRegister.gender" name="radioGroup">
            <a-radio value="0">女</a-radio>
            <a-radio value="1">男</a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item :wrapper-col="{ span: 14, offset: 4 }">
          <a-flex justify="center" gap="large">
            <a-button
              key="submit"
              type="primary"
              :loading="loading"
              @click="registerUser"
            >
              立即注册
            </a-button>
          </a-flex>
        </a-form-item>
      </a-form>
    </a-flex>
    <a-flex justify="end">
      <a-button
        v-if="loginCard"
        size="small"
        danger
        type="link"
        @click="checkType(false)"
        >注册</a-button
      >
      <a-button v-else size="small" type="link" @click="checkType(true)"
        >登录</a-button
      >
    </a-flex>
  </a-modal>
</template>
<script setup lang="ts">
import { reactive, ref, watchEffect } from "vue";
import { message } from "ant-design-vue";
import httpClient from "@view/services/http";
import { useChatStore } from "@view/stores/chat";
const open = ref(false);
const loading = ref(false);
const chatService = useChatStore();
const loginCard = ref(true);

const labelCol = { span: 6 };
const wrapperCol = { span: 18 };

const formState = reactive({
  username: "123",
  password: "123456",
});

const formRegister = reactive({
  username: "",
  password: "",
  nickname: "",
  avatar: "",
  gender: "",
});

const checkType = (val: boolean) => {
  loginCard.value = val;
  formRegister.username = "";
  formRegister.password = "";
  formState.username = "";
  formState.password = "";
};

const handleCancel = () => {
  formState.username = "";
  formState.password = "";
};

const handleOk = async () => {
  loading.value = true;
  const res = await httpClient.post("/auth/login", {
    username: formState.username,
    password: formState.password,
  });
  if (res.code === 0) {
    open.value = false;
    loading.value = false;
    // await router.push({path: "/", force: true});
    window.location.href = "/";
  } else {
    message.error(res.message);
    loading.value = false;
  }
  loading.value = false;
};

const registerUser = () => {};

watchEffect(() => {
  open.value = !chatService.getTokenStatus;
});
</script>
<style scoped lang="less">
.ant-form {
  width: 80%;
}
</style>
