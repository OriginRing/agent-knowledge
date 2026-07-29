from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from services.file_service import FileService
from services.file_process_service import FileProcessService
from services.knowledge_service import KnowledgeService

router = APIRouter(prefix="/file", tags=["file"])

class KnowledgeUploadRequest(BaseModel):
    url: str = Field(..., description="文件URL地址（OSS地址）")
    fileName: str = Field(..., description="文件名")

def _validate_upload(filename: str, size: int) -> Optional[str]:
    import os

    extension = os.path.splitext(filename or "")[1].lower()
    if extension not in FileProcessService.SUPPORTED_EXTENSIONS:
        return f"不支持的文件类型: {extension or '未知'}"
    max_size = 5 * 1024 * 1024 if extension in FileProcessService.IMAGE_EXTENSIONS else 10 * 1024 * 1024
    if size > max_size:
        return f"文件不能超过 {max_size // 1024 // 1024}MB"
    return None

@router.post("/upload", summary="上传文件到阿里云OSS")
async def upload_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    error = _validate_upload(file.filename or "", len(file_bytes))
    if error:
        return {"code": -1, "message": error}
    return FileService.upload_file(file_bytes, file.filename)

@router.post("/uploads", summary="批量上传文件到阿里云OSS")
async def upload_files(files: List[UploadFile] = File(...)):
    file_list = []
    for file in files:
        content = await file.read()
        error = _validate_upload(file.filename or "", len(content))
        if error:
            return {"code": -1, "message": f"{file.filename}: {error}"}
        file_list.append({'content': content, 'filename': file.filename})
    
    return FileService.upload_files(file_list)

@router.post("/knowledge/upload", summary="上传知识库文件")
async def upload_knowledge(request: KnowledgeUploadRequest):
    return KnowledgeService.upload_knowledge(request.url, request.fileName)

@router.post("/knowledge/clear", summary="清空知识库")
async def clear_knowledge():
    return KnowledgeService.clear_knowledge()
