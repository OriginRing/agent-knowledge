<template>
  <a-list
    :style="{
      '--color-bg-layout': token.colorBorder,
    }"
  >
    <a-list-item key="1" @click="newConversation">
      <a-flex gap="large">
        <span>
          <FormOutlined />
          新对话
        </span>
        <kbd>⌘ K</kbd>
      </a-flex>
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
    <a-list-item key="4">
      <router-link class="memory" to="/memory">
        <SearchOutlined />
        个人记忆
      </router-link>
    </a-list-item>
  </a-list>

  <a-modal v-model:open="open" title="上传知识库" width="600px" centered>
    <a-tabs v-model:active-key="activeKey">
      <a-tab-pane key="1" tab="文件上传">
        <a-flex align="center" justify="center" style="height: 110px">
          <a-upload
            :file-list="fileList"
            :before-upload="beforeUpload"
            :show-upload-list="false"
            @remove="removeUpload"
          >
            <a-button> <UploadOutlined /> {{ fileName }} </a-button>
          </a-upload>
        </a-flex>
      </a-tab-pane>
      <a-tab-pane key="2" tab="URL">
        <a-form
          :model="fileForm"
          :label-col="{ span: 4 }"
          :wrapper-col="{ span: 16 }"
        >
          <a-form-item
            label="文件名"
            name="name"
            :rules="[{ required: true, message: 'Please input file name!' }]"
          >
            <a-input v-model:value="fileForm.name" />
          </a-form-item>

          <a-form-item
            label="URL"
            name="url"
            :rules="[{ required: true, message: 'Please input file url!' }]"
          >
            <a-input v-model:value="fileForm.url" />
          </a-form-item>
        </a-form>
      </a-tab-pane>
    </a-tabs>

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
import { reactive, ref } from "vue";
import { useChatStore } from "@view/stores/chat";
import { createChatSession } from "@view/utils/random";
import { useRouter } from "vue-router";
import httpClient from "@view/services/http";

const { useToken } = theme;
const { token } = useToken();
const router = useRouter();
const chatService = useChatStore();
const activeKey = ref("1");
const fileForm = reactive({
  name: "",
  url: "",
});

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
  const formData = new FormData();
  if (fileList.value && fileList.value.length > 0) {
    const file = fileList.value[0].originFileObj || fileList.value[0];
    formData.append("file", file as File);
  }
  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      if (res.data.url) {
        await uploadKnowledge(res.data.filename, res.data.url);
      } else {
        message.error("未获取上传文件地址!");
        loading.value = false;
      }
    } else {
      message.error("文件上传失败!");
      loading.value = false;
    }
  } catch {
    message.error("文件上传失败!");
    loading.value = false;
  }
};

const uploadKnowledge = async (filename: string, url: string) => {
  const knowRes = await httpClient.post("/file/knowledge/upload", {
    url: url,
    fileName: filename,
  });
  if (knowRes.code === 0) {
    message.success("已上传到知识库!");
    fileList.value = [];
    fileName.value = "";
    fileForm.url = "";
    fileName.value = "";
    loading.value = false;
    console.log(knowRes.data);
    handleCancel();
  } else {
    message.error("未正常上传到知识库!");
    loading.value = false;
  }
};

const handleOk = async () => {
  loading.value = true;
  if (activeKey.value === "1") {
    await handleUpload();
  } else {
    await uploadKnowledge(fileForm.name, fileForm.url);
  }
};

const handleCancel = () => {
  open.value = false;
  fileList.value = [];
  fileName.value = "";
  fileForm.url = "";
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

  .knowledge,
  .memory {
    cursor: pointer;
    color: inherit;
  }
}
</style>
