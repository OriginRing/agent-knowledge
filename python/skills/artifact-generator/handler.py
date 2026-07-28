from services.document_service import DocumentService


def execute(content: str, artifact_format: str, title: str = "AI 生成文件", **_) -> dict:
    return DocumentService.create_and_upload(
        content,
        title=title,
        artifact_format=artifact_format,
    )
