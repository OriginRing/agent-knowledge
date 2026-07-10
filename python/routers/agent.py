from fastapi import APIRouter, Cookie
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from agent.agent_service import AgentService
from services.history_service import add_history_record

router = APIRouter(prefix="/agent", tags=["agent"])

class ChatRequest(BaseModel):
    agentCode: str = Field(..., description="智能体标识")
    text: str = Field(..., description="对话文本")
    files: str = Field(..., description="文件URL列表")
    thinking: bool = Field(default=False, description="是否启用思考模式")
    knowledge: bool = Field(default=False, description="是否启用知识库检索")
    connect: bool = Field(default=False, description="是否启用联网搜索")
    sessionId: Optional[str] = Field(None, description="会话ID")

class ApiResponse(BaseModel):
    code: int = Field(0, description="状态码：0-成功，非0-失败")
    message: str = Field("success", description="提示信息")
    data: Optional[Any] = Field(None, description="响应数据")

async def chat_generator(request: ChatRequest, username: str):
    full_content = ""
    full_think_message = ""
    knowledge_data = []
    async for chunk in AgentService.chat_stream(
            agent_code=request.agentCode,
            text=request.text,
            files=request.files,
            thinking=request.thinking,
            knowledge=request.knowledge,
            connect=request.connect,
            session_id=request.sessionId,
            username=username
        ):
        yield f"data: {chunk}\n\n"
        
        import json
        chunk_data = json.loads(chunk)
        if 'error' not in chunk_data and not chunk_data.get('done', False):
            full_content += chunk_data.get('content', '')
            full_think_message += chunk_data.get('thinkMessage', '')
            chunk_knowledge = chunk_data.get('knowledge', [])
            if isinstance(chunk_knowledge, list) and chunk_knowledge:
                knowledge_data = chunk_knowledge
    
    if full_content and username:
        add_history_record(
            session_id=request.sessionId,
            username=username,
            agent_code=request.agentCode,
            request_data=request.dict(),
            response_data={
                'content': full_content,
                'files': request.files,
                'thinkMessage': full_think_message,
                'agentCode': request.agentCode,
                'agentName': '',
                'thinking': request.thinking,
                'knowledge': knowledge_data,
                'done': True
            }
        )

@router.post("/chat", summary="智能体对话（SSE流式输出）")
async def chat(request: ChatRequest, access_token: str = Cookie(None)):
    from services.user_service import decode_token
    
    username = None
    if access_token:
        payload = decode_token(access_token)
        if payload:
            username = payload.get('sub')
    
    return StreamingResponse(
        chat_generator(request, username),
        media_type="text/event-stream"
    )

@router.get("/list", response_model=ApiResponse, summary="获取智能体列表")
async def get_agent_list():
    return AgentService.get_agent_list()

@router.get("/clear-knowledge", summary="清空知识库")
async def clear_knowledge():
    from services.knowledge_service import KnowledgeService
    return KnowledgeService.clear_knowledge()

class KnowledgeSearchRequest(BaseModel):
    search: str = Field(..., description="检索关键词")

@router.post("/knowledge", summary="知识库检索")
async def search_knowledge(request: KnowledgeSearchRequest):
    from services.knowledge_service import KnowledgeService
    
    result = KnowledgeService.search_knowledge(request.search, format="json")
    
    return {
        'code': 0,
        'message': 'success',
        'data': result['results']
    }
