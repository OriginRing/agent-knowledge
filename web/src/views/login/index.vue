<template>
  <div>
    <a-modal
      v-model:open="open"
      title="登录"
      :closable="false"
      :mask-closable="false"
    >
      <template #footer>
        <a-button
          key="submit"
          type="primary"
          :loading="loading"
          @click="handleOk"
          >确定</a-button
        >
      </template>
      <a-form layout="vertical" :model="formState">
        <a-form-item label="账号">
          <a-input
            v-model:value="formState.username"
            placeholder="Enter your username"
          />
        </a-form-item>
        <a-form-item label="密码">
          <a-input
            v-model:value="formState.password"
            placeholder="Enter your password"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>
<script setup lang="ts">
import { reactive, ref, watchEffect } from "vue";
import { message } from "ant-design-vue";
import httpClient from "@view/services/http";
import { useChatStore } from "@view/stores/chat";
import { useRouter } from "vue-router";

const router = useRouter();
const open = ref(false);
const loading = ref(false);
const chatService = useChatStore();

const formState = reactive({
  username: "123",
  password: "123456",
});

const handleOk = async () => {
  loading.value = true;
  const res = await httpClient.post("/auth/login", {
    username: formState.username,
    password: formState.password,
  });
  if (res.code === 0) {
    open.value = false;
    await router.push("/");
  } else {
    message.error(res.data.message);
  }
  loading.value = false;
};

watchEffect(() => {
  open.value = !chatService.getTokenStatus;
});
</script>
<style scoped lang="less"></style>
