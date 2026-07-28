---
name: file-reader
description: 下载用户文件，执行 OCR 或正文提取，并把解析内容提供给模型。
entrypoint: handler.py:execute
kind: executor
order: 10
file_extensions: .jpg,.jpeg,.png,.gif,.bmp,.webp,.pdf,.docx,.xlsx,.txt,.md,.html,.htm,.ofd
---

读取并解析用户上传的文件。图片执行 OCR，其他支持的文档直接提取正文。
