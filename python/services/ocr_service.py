import os
import base64

from openai import OpenAI

class OCRService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            api_key = os.getenv("QWEN_API_KEY")
            if not api_key:
                raise ValueError("QWEN_API_KEY 未配置")
            
            cls._client = OpenAI(
                api_key=api_key,
                base_url="https://ws-llqm293c458947bs.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
            )
        return cls._client

    @classmethod
    def extract_text_from_image_url(cls, image_url: str) -> str:
        try:
            client = cls.get_client()
            completion = client.chat.completions.create(
                model="qwen3.5-ocr",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": image_url
                                },
                            },
                            {"type": "text", "text": "请仅输出图像中的文本内容。"},
                        ],
                    },
                ],
            )
            return completion.choices[0].message.content
        
        except Exception as e:
            print(f"[OCRService] 图片OCR失败: {e}")
            return ""