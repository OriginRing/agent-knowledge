<template>
  <a-list
    :style="{
      '--color-bg-layout': token.colorBorder,
    }"
  >
    <a-list-item key="1" @click="newConversation">
      <FormOutlined />
      新对话
    </a-list-item>
    <a-list-item key="1" @click="() => (open = true)">
      <UploadOutlined />
      上传知识库
    </a-list-item>
    <a-list-item key="2" @click="clearKnowledge">
      <ClearOutlined />
      清除知识库
    </a-list-item>
    <a-list-item key="3">
      <router-link class="knowledge" to="/knowledge">
        <SearchOutlined />
        知识库检索
      </router-link>
    </a-list-item>
  </a-list>

  <a-modal v-model:open="open" title="上传知识库" width="600px" centered>
    <a-flex align="center" justify="center" style="height: 80px">
      <a-upload
        :file-list="fileList"
        :before-upload="beforeUpload"
        :show-upload-list="false"
        @remove="removeUpload"
      >
        <a-button> <UploadOutlined /> {{ fileName }} </a-button>
      </a-upload>
    </a-flex>

    <template #footer>
      <a-button key="back" @click="handleCancel">取消</a-button>
      <a-button
        key="submit"
        type="primary"
        :loading="loading"
        @click="handleOk"
      >
        上传
      </a-button>
    </template>
  </a-modal>
</template>
<script setup lang="ts">
import {
  ClearOutlined,
  SearchOutlined,
  UploadOutlined,
  FormOutlined,
} from "@ant-design/icons-vue";
import { message, theme, UploadProps } from "ant-design-vue";
import { ref } from "vue";
import { useChatStore } from "@view/stores/chat";
import { createChatSession } from "@view/utils/random";
import { useRouter } from "vue-router";
import httpClient from "@view/services/http";

const { useToken } = theme;
const { token } = useToken();
const router = useRouter();
const chatService = useChatStore();

const loading = ref<boolean>(false);
const open = ref<boolean>(false);
const fileList = ref<UploadProps["fileList"]>([]);
const fileName = ref<string>("");

const beforeUpload: UploadProps["beforeUpload"] = (file) => {
  fileList.value = [file];
  fileName.value = file.name;
  return false;
};

const removeUpload: UploadProps["onRemove"] = (file) => {
  const index = fileList.value?.indexOf(file) || -1;
  const newFileList = fileList.value?.slice() || [];
  newFileList.splice(index, 1);
  fileList.value = newFileList;
};

const handleUpload = async () => {
  loading.value = true;
  const formData = new FormData();
  if (fileList.value && fileList.value.length > 0) {
    const file = fileList.value[0].originFileObj || fileList.value[0];
    formData.append("file", file as File);
  }
  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      if (res.data.url) {
        const knowRes = await httpClient.post("/file/knowledge/upload", {
          url: res.data.url,
          fileName: res.data.filename,
        });
        if (knowRes.code === 0) {
          message.success("已上传到知识库!");
          fileList.value = [];
          fileName.value = "";
          loading.value = false;
          console.log(knowRes.data);
          handleCancel();
        } else {
          message.error("未正常上传到知识库!");
          loading.value = false;
        }
      }
    } else {
      message.error("未正常上传到知识库!");
      loading.value = false;
    }
  } catch {
    message.error("未正常上传到知识库!");
    loading.value = false;
  }
};

const handleOk = async () => {
  await handleUpload();
};

const handleCancel = () => {
  open.value = false;
  fileList.value = [];
  fileName.value = "";
};

const clearKnowledge = async () => {
  const res = await httpClient.post("/file/knowledge/clear", {});
  if (res.code === 0) {
    message.success("已清除知识库内容!");
  } else {
    message.error("清除知识库内容失败!");
  }
};

const newConversation = () => {
  if (router.currentRoute.value.path !== "/") {
    router.push("/");
  }
  chatService.setAgentHistoryDetail([]);
  chatService.setNewConversation(createChatSession());
};
</script>
<style scoped lang="less">
.ant-list-item {
  border: none;
  padding: 8px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;

  &:hover {
    background-color: var(--color-bg-layout);
    border-radius: 8px;
  }

  span {
    margin-right: 4px;
  }

  .knowledge {
    cursor: pointer;
    color: inherit;
  }
}
</style>
