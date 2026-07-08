from pydantic import BaseModel, Field, field_validator
from typing import Optional, Any

class UserRegisterRequest(BaseModel):
    username: str = Field(..., description="用户名（纯数字）")
    password: str = Field(..., min_length=6, description="密码（至少6位）")
    avatar: Optional[str] = Field(None, description="头像URL")
    nickname: Optional[str] = Field(None, description="昵称")
    gender: Optional[int] = Field(None, description="性别：0-女，1-男")
    age: Optional[int] = Field(None, description="年龄")

    @field_validator('username')
    def username_must_be_digits(cls, v):
        if not v.isdigit():
            raise ValueError('用户名必须为纯数字')
        return v

class UserLoginRequest(BaseModel):
    username: str = Field(..., description="用户名（纯数字）")
    password: str = Field(..., description="密码")

    @field_validator('username')
    def username_must_be_digits(cls, v):
        if not v.isdigit():
            raise ValueError('用户名必须为纯数字')
        return v

class UserResponse(BaseModel):
    id: int
    username: str
    avatar: Optional[str]
    nickname: Optional[str]
    gender: Optional[int]
    age: Optional[int]
    created_at: str

    class Config:
        from_attributes = True

class ApiResponse(BaseModel):
    code: int = Field(0, description="状态码：0-成功，非0-失败")
    message: str = Field("success", description="提示信息")
    data: Optional[Any] = Field(None, description="响应数据")