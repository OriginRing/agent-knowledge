export function formatFileSize(bytes: number, fixed = 2): string {
  if (bytes === 0) return "0 B";

  const unitList = ["B", "KB", "MB", "GB", "TB"];
  // 换算基数 1024
  const base = 1024;
  // 计算单位层级
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(base));
  // 计算对应大小
  const size = bytes / Math.pow(base, unitIndex);
  // 保留指定位小数
  const formatSize = size.toFixed(fixed).replace(/\.00$/, "");

  return `${formatSize} ${unitList[unitIndex]}`;
}

export function getFileExtUpper(fileName: string): string {
  if (!fileName) return "-";
  // 取最后一个 . 分割后的内容
  const dotIndex = fileName.lastIndexOf(".");
  // 没有点 / 点在第一位（如 .gitignore）视为无后缀
  if (dotIndex <= 0) return "";
  const ext = fileName.slice(dotIndex + 1);
  return ext.toUpperCase();
}

export function getFileNameWithoutExt(fileName: string): string {
  if (!fileName) return "-";
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) return fileName;
  return fileName.slice(0, dotIndex);
}

export function isImageFile(fileName: string | File): boolean {
  const name = typeof fileName === "string" ? fileName : fileName.name;
  const ext = getFileExtUpper(name);
  // 常见图片后缀
  const imageExts = ["PNG", "JPG", "JPEG", "GIF", "WEBP", "BMP", "SVG", "TIFF"];
  return imageExts.includes(ext);
}

export function splitUrlToFileArr(
  urlStr: string,
): { name: string; url: string }[] {
  if (!urlStr) return [];
  // 1. 按逗号拆分url列表，过滤空值
  const urlList = urlStr
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return urlList.map((url) => {
    let name: string;
    try {
      const pathName = new URL(url, "http://localhost").pathname;
      name = decodeURIComponent(pathName.split("/").pop() || "");
    } catch {
      name = decodeURIComponent(url.split("?")[0].split("/").pop() || "");
    }
    return {
      name,
      url,
    };
  });
}
