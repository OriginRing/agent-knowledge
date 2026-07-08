import os
import io
import requests
from typing import List, Optional, Dict, Any

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
        else:
            return cls.extract_text_from_txt(content)

    @classmethod
    def process_files_for_ollama(cls, file_urls: List[str]) -> str:
        file_contents = []
        for url in file_urls:
            try:
                filename = os.path.basename(url)
                content = cls.download_file_from_url(url)
                text = cls.extract_text(content, filename, url)
                if text.strip():
                    file_contents.append(f"【文件内容】\n文件名：{filename}\n文件内容：{text}")
            except Exception as e:
                print(f"[FileProcessService] 处理文件失败 {url}: {e}")
        
        if file_contents:
            return "\n\n".join(file_contents) + "\n\n"
        return ""

    @classmethod
    def process_files_for_api(cls, file_urls: List[str]) -> List[Dict[str, Any]]:
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        
        files = []
        for url in file_urls:
            try:
                ext = os.path.splitext(url)[1].lower()
                if ext in image_extensions:
                    files.append({
                        "type": "image_url",
                        "image_url": {
                            "url": url
                        }
                    })
                else:
                    files.append({
                        "type": "text",
                        "text": f"[文件参考]: {url}"
                    })
            except Exception as e:
                print(f"[FileProcessService] 处理文件失败 {url}: {e}")
        
        return files