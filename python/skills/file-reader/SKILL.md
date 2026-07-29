---
name: file-reader
description: 下载用户文件，执行 OCR 或正文提取，并把解析内容提供给模型。
entrypoint: handler.py:execute
kind: executor
order: 10
file_extensions: .jpg,.jpeg,.png,.gif,.bmp,.webp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.ppt,.pptx,.html,.htm,.ofd
---

读取并解析用户上传的文件。图片与文档内嵌图片执行 OCR，扫描 PDF/OFD 自动回退到整页 OCR；其他支持的文档提取正文、表格及来源位置。
