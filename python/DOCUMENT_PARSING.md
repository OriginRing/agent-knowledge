# 文档解析运行环境

对话附件与知识库上传共用 `FileProcessService`。支持以下格式：

- 图片：JPG、JPEG、PNG、GIF、BMP、WebP、TIFF
- 文档：PDF、DOC、DOCX、XLS、XLSX、TXT、MD、PPT、PPTX、HTML、HTM、OFD

安装 `requirements.txt` 后，还需要在部署环境中安装 LibreOffice。`.doc`、`.xls`
和 `.ppt` 会通过无界面模式转换为 OOXML，再进入对应解析器。若可执行文件不在
`PATH`，使用 `LIBREOFFICE_BINARY` 指定绝对路径。

文档解析配置统一在 `.env` 中维护：

- `MAX_PARSE_FILE_BYTES`：远程文件解析上限，默认 20MB。
- `FILE_DOWNLOAD_TIMEOUT_SECONDS`：远程下载超时，默认 30 秒。
- `LIBREOFFICE_TIMEOUT_SECONDS`：旧版 Office 转换超时，默认 60 秒。
- `PDF_OCR_MIN_TEXT_CHARS`：PDF 页面触发 OCR 的最少原生文本字符数。
- `PDF_OCR_DPI`：扫描页渲染 DPI。
- `OCR_TIMEOUT_SECONDS`、`OCR_MAX_RETRIES`：OCR 调用超时和重试次数。
- `OCR_MAX_IMAGE_DIMENSION`、`OCR_JPEG_QUALITY`：OCR 图片缩放和压缩参数。

OCR 使用 `QWEN_API_KEY`、`QWEN_OCR_BASE_URL` 和 `QWEN_OCR_MODEL`。知识库使用
`KNOWLEDGE_EMBEDDING_MODEL` 指定 Ollama Embedding 模型。以上变量均为必填项，
可参考 `.env-example`。单张图片识别失败会记录为警告；文档中已经成功提取的
正文仍会进入对话和知识库。
