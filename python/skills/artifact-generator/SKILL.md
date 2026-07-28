---
name: artifact-generator
description: 将模型输出生成 DOCX、XLSX、PPTX 或 PDF 并上传 OSS。
entrypoint: handler.py:execute
kind: artifact
order: 100
artifact: docx,xlsx,pptx,pdf
---

根据用户要求把最终回答生成文件并上传 OSS。
