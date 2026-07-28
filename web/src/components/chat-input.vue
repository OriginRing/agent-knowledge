<template>
  <div
    class="agent-input"
    :style="{
      '--color-text-tertiary': token.colorTextTertiary,
      '--color-bg': token.colorFillQuaternary,
      '--color-bg-elevated': token.colorBgElevated,
    }"
  >
    <Sender
      v-model:value="chatInput"
      placeholder="请输入..."
      :auto-size="{ minRows: 1, maxRows: 3 }"
      :actions="false"
      @keydown="handleEnter"
    >
      <template #header>
        <a-flex v-if="uploadFiles.length" class="input-file">
          <a-flex class="input-file-scroll" gap="12">
            <a-flex
              v-for="(file, index) in uploadFiles"
              :key="index"
              class="file-box-scroll"
              style="position: relative"
            >
              <div v-if="!file.loading && !file.url" class="file-error">
                <a-flex align="center" justify="center">
                  <ExclamationOutlined @click="refreshFile(file.file, index)" />
                </a-flex>
              </div>
              <a-spin :spinning="file.loading">
                <a-flex class="file-box" gap="8">
                  <CloseCircleOutlined
                    class="close"
                    @click="clearFile(index)"
                  />
                  <a-image
                    v-if="isImageFile(file.name)"
                    :width="50"
                    :src="file.image"
                  >
                  </a-image>
                  <FileTextOutlined
                    v-else
                    style="font-size: 50px"
                    class="file-icon"
                  />
                  <a-flex vertical gap="8" justify="center">
                    <p>{{ file.name }}</p>
                    <span
                      >{{ getFileExtUpper(file.name) }}·{{
                        formatFileSize(file.file.size)
                      }}</span
                    >
                  </a-flex>
                </a-flex>
              </a-spin>
            </a-flex>
          </a-flex>
        </a-flex>
      </template>
      <template #footer="{ info: { components } }">
        <a-flex justify="space-between" align="center">
          <a-flex gap="small" align="center">
            <template v-if="chatService.getAgentDetail?.supportFile">
              <a-dropdown placement="topLeft" trigger="click">
                <a-button type="text">
                  <template #icon>
                    <PaperClipOutlined />
                  </template>
                </a-button>
                <template #overlay>
                  <a-menu>
                    <a-menu-item>
                      <a-upload
                        ref="imageUploadRef"
                        :show-upload-list="false"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        :before-upload="handleImageBeforeUpload"
                      >
                        <a-flex justify="center">上传图片</a-flex>
                      </a-upload>
                    </a-menu-item>
                    <a-menu-item>
                      <a-upload
                        ref="fileUploadRef"
                        :show-upload-list="false"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md"
                        :before-upload="handleFileBeforeUpload"
                      >
                        <a-flex justify="center">上传文档</a-flex>
                      </a-upload>
                    </a-menu-item>
                  </a-menu>
                </template>
              </a-dropdown>
              <a-divider type="vertical" />
            </template>
            <template v-if="chatService.getAgentDetail?.supportThink">
              深度思考
              <a-switch v-model:checked="thinking" size="small" />
              <a-divider type="vertical" />
            </template>
            <template v-if="chatService.getAgentDetail?.supportKnowledge">
              <a-button
                :type="knowledge ? 'link' : 'text'"
                shape="circle"
                @click="connectKnowledge"
              >
                <ApiOutlined />
              </a-button>
              <a-divider type="vertical" />
            </template>

            <a-button
              v-if="chatService.getAgentDetail?.supportConnect"
              :type="internet ? 'link' : 'text'"
              shape="circle"
              @click="connectInternet"
            >
              <GlobalOutlined />
            </a-button>
            <div />
          </a-flex>
          <a-flex align="center">
            <component
              :is="components.SendButton"
              v-if="!supportStop"
              type="primary"
              @click="sendQuestion"
            />
            <component
              :is="components.LoadingButton"
              v-else
              type="primary"
              :disabled="false"
              @click="emit('stopMessage')"
            />
          </a-flex>
        </a-flex>
      </template>
    </Sender>
    <div class="agent-input-tip">AI 生成可能有误，请核实</div>
  </div>
</template>
<script lang="ts" setup>
import { nextTick, ref } from "vue";
import {
  ApiOutlined,
  GlobalOutlined,
  PaperClipOutlined,
  FileTextOutlined,
  CloseCircleOutlined,
  ExclamationOutlined,
} from "@ant-design/icons-vue";
import { Sender } from "ant-design-x-vue";
import { useChatStore } from "@view/stores/chat";
import { message, theme } from "ant-design-vue";
import httpClient from "@view/services/http";
import { formatFileSize, getFileExtUpper, isImageFile } from "@view/utils/file";

const emit = defineEmits(["stopMessage", "sendMessage"]);
const _props = defineProps({
  supportStop: Boolean,
});

const { useToken } = theme;
const { token } = useToken();
const chatInput = ref<string>("");
const chatService = useChatStore();
const thinking = ref(true);
const internet = ref(false);
const knowledge = ref(false);
const uploadFiles = ref<
  Array<{
    file: File;
    name: string;
    url: string;
    loading: boolean;
    image?: string;
  }>
>([]);

const connectInternet = () => {
  internet.value = !internet.value;
};

const connectKnowledge = () => {
  knowledge.value = !knowledge.value;
};

const handleEnter = (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    e.preventDefault();
    if (!chatInput.value.trim()) return;
    emit("stopMessage");
    emit(
      "sendMessage",
      chatInput.value,
      uploadFiles.value
        .map((v) => v.url)
        .filter(Boolean)
        .join(","),
      thinking.value,
      knowledge.value,
      internet.value,
    );
    chatInput.value = "";
    uploadFiles.value = [];
    (e.target as HTMLElement)?.blur();
  }
};

const sendQuestion = () => {
  emit(
    "sendMessage",
    chatInput.value,
    uploadFiles.value
      .map((v) => v.url)
      .filter(Boolean)
      .join(","),
    thinking.value,
    knowledge.value,
    internet.value,
  );
  chatInput.value = "";
  uploadFiles.value = [];
};

const clearFile = (index: number) => {
  uploadFiles.value.splice(index, 1);
};

const refreshFile = (file: File, index: number) => {
  if (isImageFile(file.name)) {
    handleImageBeforeUpload(file, [], true, index);
  } else {
    handleFileBeforeUpload(file, [], true, index);
  }
};

const handleImageBeforeUpload = async (
  file: File,
  fileList: File[],
  refresh: boolean = false,
  num?: number,
) => {
  // 大小限制：5MB
  const isLt5M = file.size / 1024 / 1024 < 5;
  if (!isLt5M) {
    message.error("图片不能超过 5MB");
    return false; // 阻止自动上传
  }
  let index = num as number;
  if (!refresh) {
    uploadFiles.value.push({
      file: file,
      url: "",
      name: file.name,
      loading: true,
      image: "",
    });
    index = uploadFiles.value.length - 1;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      uploadFiles.value[index].image = base64;
      nextTick();
    };
  }

  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      uploadFiles.value[index].url = res?.data?.url;
      uploadFiles.value[index].name = res?.data?.filename;
    }
    uploadFiles.value[index].loading = false;
  } catch {
    uploadFiles.value[index].loading = false;
  }
  return false;
};

const handleFileBeforeUpload = async (
  file: File,
  fileList: File[],
  refresh: boolean = false,
  num?: number,
) => {
  // 文档限制 10MB
  const isLt10M = file.size / 1024 / 1024 < 10;
  if (!isLt10M) {
    message.error("文档不能超过 10MB");
    return false;
  }
  let index = num as number;
  if (!refresh) {
    uploadFiles.value.push({
      file: file,
      url: "",
      name: file.name,
      loading: true,
    });
    index = uploadFiles.value.length - 1;
  }

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await httpClient.post("/file/upload", formData);
    if (res.code === 0) {
      uploadFiles.value[index].url = res?.data?.url;
      uploadFiles.value[index].name = res?.data?.filename;
    }
    uploadFiles.value[index].loading = false;
  } catch {
    uploadFiles.value[index].loading = false;
  }
  return false;
};
</script>
<style lang="less" scoped>
.agent-input {
  position: relative;
  width: 100%;
  height: 100%;

  .agent-input-tip {
    position: absolute;
    bottom: 0px;
    font-size: 12px;
    left: 50%;
    transform: translateX(-50%);
    color: var(--color-text-tertiary);
  }
}
.input-file {
  padding: 8px 8px 0;
  overflow: hidden;

  .input-file-scroll {
    overflow: scroll;
  }

  .file-box-scroll {
    width: 200px;
    flex: 0 0 200px;
  }

  .file-error {
    position: absolute;
    z-index: 9;
    width: 100%;
    height: 100%;
    background-color: var(--color-bg-elevated);
    opacity: 0.5;
    cursor: pointer;

    .ant-flex {
      height: 100%;
    }
    span {
      font-size: 24px;
    }
  }

  .file-box {
    position: relative;
    padding: 8px;
    background-color: var(--color-bg);
    border-radius: 4px;
    max-width: 200px;
    overflow: hidden;

    .close {
      position: absolute;
      right: 2px;
      top: 2px;
      font-size: 14px;
      height: 14px;
      border-radius: 8px;
      background-color: var(--color-bg-elevated);
    }

    :deep(.ant-image) {
      flex: 0 0 50px;
      width: 50px;
    }

    .file-icon {
      width: 50px;
      flex: 0 0 50px;
    }

    p {
      font-size: 14px;
      line-height: 18px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    span {
      display: inline-block;
      color: var(--color-text-tertiary);
      font-size: 12px;
      line-height: 14px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}
</style>
