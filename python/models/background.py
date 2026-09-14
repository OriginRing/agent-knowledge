from pydantic import BaseModel, ConfigDict, Field, HttpUrl


class BackgroundImageCreateRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    name: str = Field(..., min_length=1, max_length=100, description='文件名')
    url: HttpUrl = Field(..., max_length=1000, description='OSS 图片地址')
