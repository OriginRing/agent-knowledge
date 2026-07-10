from fastapi import APIRouter, Response, Cookie
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from models.user import UserRegisterRequest, UserLoginRequest, ApiResponse
from services.user_service import register_user, login_user, decode_token, get_user_by_id
from services.history_service import get_history_list, get_history_detail, delete_history_record
from services.memory_service import add_memory, search_memory, list_memories, delete_memory, update_memory

router = APIRouter(prefix="/auth", tags=["auth"])

class HistoryRequest(BaseModel):
    agentCode: Optional[str] = Field(None, description="智能体标识")

class HistoryDetailRequest(BaseModel):
    id: Optional[int] = Field(None, description="历史记录ID")
    sessionId: Optional[str] = Field(None, description="会话ID")

@router.post("/register", response_model=ApiResponse, summary="用户注册")
async def register(request: UserRegisterRequest):
    return register_user(request)

@router.post("/login", response_model=ApiResponse, summary="用户登录")
async def login(request: UserLoginRequest, response: Response):
    result = login_user(request.username, request.password)
    if result['code'] == 0:
        access_token = result['data']['access_token']
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            secure=False,
            samesite="lax",
            max_age=1800
        )
    return result

@router.get("/logout", response_model=ApiResponse, summary="退出登录")
async def logout(response: Response, access_token: str = Cookie(None)):
    response.set_cookie(
        key="access_token",
        value="",
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=0
    )
    return {'code': 0, 'message': 'success'}

@router.get("/userinfo", response_model=ApiResponse, summary="获取用户信息")
async def get_userinfo(access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}
    
    user = get_user_by_id(payload.get('id'))
    if not user:
        return {'code': 1, 'message': '用户不存在'}
    
    return {
        'code': 0,
        'message': 'success',
        'data': user
    }

@router.post("/history", response_model=ApiResponse, summary="获取历史记录列表")
async def get_history(request: HistoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}
    
    username = payload.get('sub')
    if not username:
        return {'code': 1, 'message': '用户不存在'}
    
    return get_history_list(username, request.agentCode)

@router.post("/history/detail", response_model=ApiResponse, summary="获取历史对话详情")
async def get_history_detail_api(request: HistoryDetailRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}
    
    username = payload.get('sub')
    if not username:
        return {'code': 1, 'message': '用户不存在'}
    
    return get_history_detail(username, request.id, request.sessionId)

class DeleteHistoryRequest(BaseModel):
    id: int = Field(..., description="历史记录ID")
    agentCode: str = Field(..., description="智能体标识")

@router.post("/history/delete", summary="删除历史记录")
async def delete_history(request: DeleteHistoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}
    
    username = payload.get('sub')
    if not username:
        return {'code': 1, 'message': '用户不存在'}
    
    return delete_history_record(request.id, request.agentCode, username)

class AddMemoryRequest(BaseModel):
    conversation_id: str = Field(None, description="会话ID")
    messages: List[Dict[str, str]] = Field(..., description="消息列表，包含role和content字段")

@router.post("/memory/add", response_model=ApiResponse, summary="添加记忆")
async def add_memory_api(request: AddMemoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}

    user_id = payload.get('sub')
    if not user_id:
        return {'code': 1, 'message': '用户不存在'}
    conv_id = request.conversation_id if request.conversation_id else None
    return add_memory(user_id, conv_id, request.messages)

class SearchMemoryRequest(BaseModel):
    query: str = Field(..., description="搜索关键词")
    conversation_id: Optional[str] = Field(None, description="会话ID (可选)")

@router.post("/memory/search", response_model=ApiResponse, summary="搜索记忆")
async def search_memory_api(request: SearchMemoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}
        
    user_id = payload.get('sub')
    if not user_id:
        return {'code': 1, 'message': '用户不存在'}
    conv_id = request.conversation_id if request.conversation_id else None
    return search_memory(user_id, conv_id, request.query)

class ListMemoryRequest(BaseModel):
    page: Optional[int] = Field(1, description="页码")
    page_size: Optional[int] = Field(10, description="每页数量")

@router.post("/memory/list", response_model=ApiResponse, summary="记忆列表")
async def list_memories_api(request: ListMemoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}

    user_id = payload.get('sub')
    if not user_id:
        return {'code': 1, 'message': '用户不存在'}
    
    return list_memories(user_id, request.page, request.page_size)

class DeleteMemoryRequest(BaseModel):
    memo_id: str = Field(..., description="记忆ID")

@router.post("/memory/delete", response_model=ApiResponse, summary="删除记忆")
async def delete_memory_api(request: DeleteMemoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}

    user_id = payload.get('sub')
    if not user_id:
        return {'code': 1, 'message': '用户不存在'}
    return delete_memory(request.memo_id)

class UpdateMemoryRequest(BaseModel):
    feedback_content: str = Field(..., description="记忆内容")
    conversation_id: str = Field(None, description="会话ID (可选)")

@router.post("/memory/update", response_model=ApiResponse, summary="订正记忆")
async def update_memory_api(request: UpdateMemoryRequest, access_token: str = Cookie(None)):
    if not access_token:
        return {'code': 1, 'message': '未登录'}
    
    payload = decode_token(access_token)
    if not payload:
        return {'code': 1, 'message': 'token无效'}

    user_id = payload.get('sub')
    if not user_id:
        return {'code': 1, 'message': '用户不存在'}

    return update_memory(request.feedback_content, request.conversation_id, user_id)