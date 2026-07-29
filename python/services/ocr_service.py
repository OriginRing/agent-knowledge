import base64
import io
import os
import time
from typing import Optional

from openai import OpenAI
from PIL import Image, ImageOps


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
                base_url=os.getenv(
                    "QWEN_OCR_BASE_URL",
                    "https://ws-llqm293c458947bs.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
                ),
                timeout=float(os.getenv("OCR_TIMEOUT_SECONDS", "45")),
            )
        return cls._client

    @classmethod
    def _prepare_image(cls, content: bytes) -> tuple[bytes, str]:
        if not content:
            raise ValueError("图片内容为空")

        max_dimension = int(os.getenv("OCR_MAX_IMAGE_DIMENSION", "2400"))
        jpeg_quality = int(os.getenv("OCR_JPEG_QUALITY", "88"))
        with Image.open(io.BytesIO(content)) as image:
            image = ImageOps.exif_transpose(image)
            if max(image.size) > max_dimension:
                image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)

            output = io.BytesIO()
            if image.mode in {"RGBA", "LA"}:
                background = Image.new("RGB", image.size, "white")
                alpha = image.getchannel("A")
                background.paste(image.convert("RGB"), mask=alpha)
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")
            image.save(output, format="JPEG", quality=jpeg_quality, optimize=True)
            return output.getvalue(), "image/jpeg"

    @classmethod
    def _recognize(cls, image_url: str, prompt: Optional[str] = None) -> str:
        retries = max(int(os.getenv("OCR_MAX_RETRIES", "1")), 0)
        last_error: Optional[Exception] = None
        for attempt in range(retries + 1):
            try:
                completion = cls.get_client().chat.completions.create(
                    model=os.getenv("QWEN_OCR_MODEL", "qwen3.5-ocr"),
                    messages=[
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "image_url",
                                    "image_url": {"url": image_url},
                                },
                                {
                                    "type": "text",
                                    "text": prompt or "请仅输出图像中的文本内容。",
                                },
                            ],
                        },
                    ],
                )
                return (completion.choices[0].message.content or "").strip()
            except Exception as exc:
                last_error = exc
                if attempt < retries:
                    time.sleep(min(2**attempt, 2))
        raise RuntimeError(f"OCR 服务调用失败: {last_error}") from last_error

    @classmethod
    def extract_text_from_image_bytes(
        cls, content: bytes, prompt: Optional[str] = None
    ) -> str:
        image_bytes, mime_type = cls._prepare_image(content)
        encoded = base64.b64encode(image_bytes).decode("ascii")
        return cls._recognize(
            f"data:{mime_type};base64,{encoded}",
            prompt=prompt,
        )

    @classmethod
    def extract_text_from_image_url(
        cls, image_url: str, prompt: Optional[str] = None
    ) -> str:
        return cls._recognize(image_url, prompt=prompt)
