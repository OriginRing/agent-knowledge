from fastapi import APIRouter, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Optional
from services.file_service import FileService
from services.knowledge_service import KnowledgeService

router = APIRouter(prefix="/file", tags=["file"])

class KnowledgeUploadRequest(BaseModel):
    url: str = Field(..., description="文件URL地址（OSS地址）")
    fileName: str = Field(..., description="文件名")

@router.post("/upload", summary="上传文件到阿里云OSS")
async def upload_file(file: UploadFile = File(...)):
    file_bytes = await file.read()
    print(file.filename)
    return FileService.upload_file(file_bytes, file.filename)

@router.post("/uploads", summary="批量上传文件到阿里云OSS")
async def upload_files(files: List[UploadFile] = File(...)):
    file_list = []
    for file in files:
        content = await file.read()
        file_list.append({'content': content, 'filename': file.filename})
    
    return FileService.upload_files(file_list)

@router.post("/knowledge/upload", summary="上传知识库文件")
async def upload_knowledge(request: KnowledgeUploadRequest):
    return KnowledgeService.upload_knowledge(request.url, request.fileName)

@router.post("/knowledge/clear", summary="清空知识库")
async def clear_knowledge():
    return KnowledgeService.clear_knowledge()