from services.file_process_service import FileProcessService


def execute(query: str, files: list[str], **_) -> dict:
    parsed_files = FileProcessService.process_files(files)
    contexts = [
        f"【{item['filename']} 解析内容】\n{item['content']}"
        for item in parsed_files
        if item["status"] == "success" and item["content"]
    ]
    return {
        "context": "\n\n".join(contexts),
        "files": parsed_files,
        "summary": f"已处理 {len(parsed_files)} 个文件",
    }
