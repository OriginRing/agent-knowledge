import { message } from "ant-design-vue";

/**
 * 点击复制文本到剪贴板（TS 版本）
 * @param text 需要复制的文本
 * @returns Promise<boolean> 成功/失败
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      message.success("已复制");
      return true;
    }
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    message.success("已复制");
    return true;
  } catch (err) {
    message.error("复制失败");
    console.error("复制失败：", err);
    return false;
  }
};
