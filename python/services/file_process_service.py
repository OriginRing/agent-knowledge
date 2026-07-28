import os
import io
import requests
from typing import List, Dict, Any
from urllib.parse import unquote, urlparse

class FileProcessService:
    @classmethod
    def download_file_from_url(cls, url: str) -> bytes:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.content

    @classmethod
    def extract_text_from_docx(cls, content: bytes) -> str:
        from docx import Document as DocxDocument
        doc = DocxDocument(io.BytesIO(content))
        paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
        return "\n".join(paragraphs)

    @classmethod
    def extract_text_from_xlsx(cls, content: bytes) -> str:
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(content))
        text_parts = []
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            for row in sheet.iter_rows(values_only=True):
                row_text = "\t".join(str(cell) for cell in row if cell is not None)
                if row_text.strip():
                    text_parts.append(row_text)
        return "\n".join(text_parts)

    @classmethod
    def extract_text_from_pdf(cls, content: bytes) -> str:
        from pypdf import PdfReader

        reader = PdfReader(io.BytesIO(content))
        return "\n".join(
            page.extract_text() or ""
            for page in reader.pages
        ).strip()

    @classmethod
    def extract_text_from_ofd(cls, content: bytes) -> str:
        return ""

    @classmethod
    def extract_text_from_html(cls, content: bytes) -> str:
        from bs4 import BeautifulSoup
        try:
            html_text = content.decode('utf-8')
        except:
            html_text = content.decode('gbk', errors='ignore')
        soup = BeautifulSoup(html_text, 'html.parser')
        return soup.get_text(separator='\n').strip()

    @classmethod
    def extract_text_from_txt(cls, content: bytes) -> str:
        try:
            return content.decode('utf-8')
        except:
            return content.decode('gbk', errors='ignore')

    @classmethod
    def extract_text_from_markdown(cls, content: bytes) -> str:
        return cls.extract_text_from_txt(content)

    @classmethod
    def extract_text_from_image(cls, url: str) -> str:
        try:
            from services.ocr_service import OCRService
            return OCRService.extract_text_from_image_url(url)
        except Exception as e:
            print(f"[FileProcessService] 图片OCR失败: {e}")
            return ""

    @classmethod
    def extract_text(cls, content: bytes, filename: str, url: str = "") -> str:
        ext = os.path.splitext(filename)[1].lower()
        
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        
        extractors = {
            '.docx': cls.extract_text_from_docx,
            '.xlsx': cls.extract_text_from_xlsx,
            '.pdf': cls.extract_text_from_pdf,
            '.ofd': cls.extract_text_from_ofd,
            '.html': cls.extract_text_from_html,
            '.htm': cls.extract_text_from_html,
            '.txt': cls.extract_text_from_txt,
            '.md': cls.extract_text_from_markdown,
        }
        
        if ext in image_extensions:
            return cls.extract_text_from_image(url)
        
        if ext in extractors:
            return extractors[ext](content)
        if not ext or ext in {'.txt', '.log', '.csv'}:
            return cls.extract_text_from_txt(content)
        raise ValueError(f"暂不支持解析该文件类型: {ext or '未知'}")

    @classmethod
    def process_files_for_ollama(cls, file_urls: List[str]) -> str:
        file_contents = [
            f"【文件内容】\n文件名：{item['filename']}\n文件内容：{item['content']}"
            for item in cls.process_files(file_urls)
            if item["status"] == "success" and item["content"].strip()
        ]
        
        if file_contents:
            return "\n\n".join(file_contents) + "\n\n"
        return ""

    @classmethod
    def process_files_for_api(cls, file_urls: List[str]) -> List[Dict[str, Any]]:
        parsed_files = cls.process_files(file_urls)
        files = []
        for item in parsed_files:
            if item["isImage"]:
                files.append({"type": "image_url", "image_url": {"url": item["url"]}})
            if item["content"]:
                files.append({
                    "type": "text",
                    "text": f"【{item['filename']} 解析内容】\n{item['content']}",
                })
        return files

    @classmethod
    def process_files(cls, file_urls: List[str]) -> List[Dict[str, Any]]:
        image_extensions = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'}
        results: List[Dict[str, Any]] = []
        for url in file_urls:
            path = unquote(urlparse(url).path)
            filename = os.path.basename(path) or "未命名文件"
            extension = os.path.splitext(filename)[1].lower()
            item: Dict[str, Any] = {
                "url": url,
                "filename": filename,
                "extension": extension,
                "isImage": extension in image_extensions,
                "content": "",
                "charCount": 0,
                "status": "success",
                "error": None,
            }
            try:
                content = cls.download_file_from_url(url)
                text = cls.extract_text(content, filename, url)
                item["content"] = text
                item["charCount"] = len(text)
                if not text.strip():
                    item["status"] = "error"
                    item["error"] = "未提取到可用内容"
            except Exception as exc:
                item["status"] = "error"
                item["error"] = str(exc)
            results.append(item)
        return results
