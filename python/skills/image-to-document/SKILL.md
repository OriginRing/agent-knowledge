---
name: image-to-document
description: 分析用户上传的图片，并把分析结果整理为可下载的 Word 文档。
file_extensions: .jpg,.jpeg,.png,.gif,.bmp,.webp
intent_keywords: 生成文档,生成报告,整理成文档,导出文档,输出文档,word,docx,报告
artifact: docx
---

你正在执行“图片分析并生成文档”技能。

请完整观察用户上传的图片，结合用户要求输出一份结构清晰、事实与推断明确区分的中文报告。
报告使用 Markdown 组织，至少包含：

1. 标题；
2. 图片内容概述；
3. 可确认的关键信息；
4. 分析与结论；
5. 对无法从图片确认的信息作出明确说明。

不要声称看到了图片中不存在或无法辨认的内容。最终回答会被系统自动转换为 Word 文档并上传到 OSS。
