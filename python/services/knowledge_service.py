import os
import time
from datetime import datetime
from typing import List, Dict, Any

from langchain_ollama import OllamaEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.documents import Document

from config.env_config import get_required_env


class KnowledgeService:
    _embeddings = None
    _vector_store = None

    @classmethod
    def get_embeddings(cls):
        if cls._embeddings is None:
            cls._embeddings = OllamaEmbeddings(
                model=get_required_env("KNOWLEDGE_EMBEDDING_MODEL")
            )
        return cls._embeddings

    @classmethod
    def get_vector_store(cls):
        if cls._vector_store is None:
            persist_directory = "./chroma_db/knowledge"
            os.makedirs(persist_directory, exist_ok=True)
            
            cls._vector_store = Chroma(
                collection_name="knowledge_base",
                embedding_function=cls.get_embeddings(),
                persist_directory=persist_directory,
            )
        
        return cls._vector_store

    @classmethod
    def generate_file_id(cls, file_name: str) -> tuple:
        name_without_ext = os.path.splitext(file_name)[0]
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        return f"{name_without_ext}_{timestamp}", timestamp

    @classmethod
    def split_text(cls, text: str, file_name: str, file_url: str, file_id: str, created_at: int, chunk_size: int = 300, chunk_overlap: int = 30) -> List[Document]:
        return cls.split_sections(
            [
                {
                    "text": text,
                    "sourceKind": "document",
                    "sourceIndex": 1,
                    "sourceLabel": "文档正文",
                    "extractionMethod": "native",
                }
            ],
            file_name,
            file_url,
            file_id,
            created_at,
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
        )

    @classmethod
    def split_sections(
        cls,
        sections: List[Dict[str, Any]],
        file_name: str,
        file_url: str,
        file_id: str,
        created_at: int,
        chunk_size: int = 300,
        chunk_overlap: int = 30,
    ) -> List[Document]:
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=len,
        )
        pending = []
        for section in sections:
            text = str(section.get("text", "")).strip()
            if not text:
                continue
            for chunk in text_splitter.split_text(text):
                pending.append((chunk, section))

        documents = []
        for index, (chunk, section) in enumerate(pending):
            documents.append(
                Document(
                    page_content=chunk,
                    metadata={
                        'chunk_index': index,
                        'total_chunks': len(pending),
                        'file_name': file_name,
                        'file_url': file_url,
                        'file_id': file_id,
                        'created_at': created_at,
                        'source_kind': str(section.get("sourceKind", "document")),
                        'source_index': int(section.get("sourceIndex", 1)),
                        'source_label': str(section.get("sourceLabel", "文档正文")),
                        'extraction_method': str(
                            section.get("extractionMethod", "native")
                        ),
                    },
                )
            )
        return documents

    @classmethod
    def add_to_vector_store(cls, documents: List[Document]):
        vector_store = cls.get_vector_store()
        vector_store.add_documents(documents)

    @classmethod
    def upload_knowledge(cls, url: str, file_name: str) -> dict:
        try:
            from services.file_process_service import FileProcessService
            
            content = FileProcessService.download_file_from_url(url)
            parsed = FileProcessService.parse_document(content, file_name, url)
            text = parsed["content"]
            
            if not text.strip():
                warning_text = "；".join(parsed.get("warnings", []))
                return {
                    'code': -1,
                    'message': f"文件内容为空{f'：{warning_text}' if warning_text else ''}",
                }
            
            file_id, created_at = cls.generate_file_id(file_name)
            print(f"[KnowledgeService] 生成file_id: {file_id}, created_at: {created_at}")
            
            documents = cls.split_sections(
                parsed["sections"], file_name, url, file_id, created_at
            )
            print(f"[KnowledgeService] 生成{len(documents)}个切片，第一个切片的file_id: {documents[0].metadata.get('file_id')}")
            
            cls.add_to_vector_store(documents)
            
            return {
                'code': 0,
                'message': 'success',
                'data': {
                    'url': url,
                    'filename': file_name,
                    'fileId': file_id,
                    'createdAt': created_at,
                    'chunk_count': len(documents),
                    'text_length': len(text),
                    'parseStatus': (
                        'partial' if parsed.get('warnings') else 'success'
                    ),
                    'pageCount': parsed.get('pageCount', 0),
                    'imageCount': parsed.get('imageCount', 0),
                    'ocrCount': parsed.get('ocrCount', 0),
                    'warnings': parsed.get('warnings', []),
                }
            }
        
        except Exception as e:
            return {'code': -1, 'message': f'知识库上传失败: {str(e)}'}

    @classmethod
    def retrieve_knowledge(cls, query: str, k: int = 3) -> List[Dict[str, Any]]:
        try:
            vector_store = cls.get_vector_store()
            results = vector_store.similarity_search(query, k=k)
            
            knowledge_items = []
            for i, doc in enumerate(results):
                file_id = doc.metadata.get('file_id', '')
                file_name = doc.metadata.get('file_name', '')
                print(f"[KnowledgeService] 检索结果{i}: file_id={file_id}, file_name={file_name}")
                knowledge_items.append({
                    'fileId': file_id,
                    'fileName': file_name,
                    'fileUrl': doc.metadata.get('file_url', ''),
                    'fileContent': doc.page_content,
                    'createdAt': doc.metadata.get('created_at', 0),
                    'sourceKind': doc.metadata.get('source_kind'),
                    'sourceIndex': doc.metadata.get('source_index'),
                    'sourceLabel': doc.metadata.get('source_label'),
                    'extractionMethod': doc.metadata.get('extraction_method'),
                })
            
            return knowledge_items
        except Exception as e:
            print(f"知识库检索失败: {e}")
            return []

    @classmethod
    def search_knowledge(cls, query: str, k: int = 3, format: str = "text") -> dict:
        try:
            docs = cls.retrieve_knowledge(query, k=k)
            
            if not docs:
                if format == "text":
                    return {"knowledge_text": "", "knowledge_items": []}
                return {"results": []}
            
            if format == "text":
                knowledge_text = "【知识库检索结果】\n"
                knowledge_items = []
                for i, doc in enumerate(docs):
                    source = doc.get('sourceLabel')
                    source_hint = (
                        f"（{doc['fileName']} / {source}）"
                        if source
                        else f"（{doc['fileName']}）"
                    )
                    knowledge_text += (
                        f"{i+1}. {source_hint}\n{doc['fileContent']}\n\n"
                    )
                knowledge_text += "\n请基于以上知识库信息回答用户问题：\n"
                
                for doc in docs:
                    knowledge_items.append({
                        'fileId': doc['fileId'],
                        'fileName': doc['fileName'],
                        'fileUrl': doc['fileUrl'],
                        'fileContent': doc['fileContent'],
                        'sourceKind': doc.get('sourceKind'),
                        'sourceIndex': doc.get('sourceIndex'),
                        'sourceLabel': doc.get('sourceLabel'),
                        'extractionMethod': doc.get('extractionMethod'),
                    })
                
                return {"knowledge_text": knowledge_text, "knowledge_items": knowledge_items}
            
            return {"results": docs}
        
        except Exception as e:
            print(f"知识库检索错误: {e}")
            if format == "text":
                return {"knowledge_text": "", "knowledge_items": []}
            return {"results": []}

    @classmethod
    def clear_knowledge(cls) -> dict:
        try:
            if cls._vector_store is not None:
                cls._vector_store.delete_collection()
                cls._vector_store = None
            
            persist_directory = "./chroma_db/knowledge"
            if os.path.exists(persist_directory):
                import shutil
                shutil.rmtree(persist_directory)
            
            return {'code': 0, 'message': '知识库已清空'}
        
        except Exception as e:
            return {'code': -1, 'message': f'清空知识库失败: {str(e)}'}

    @classmethod
    def get_knowledge_count(cls) -> int:
        try:
            vector_store = cls.get_vector_store()
            return vector_store._collection.count()
        except Exception:
            return 0
