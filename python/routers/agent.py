from fastapi import APIRouter, Cookie
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Any, List
import json
import uuid
from agent.agent_service import AgentService
from services.history_service import start_history_record, finalize_history_record

router = APIRouter(prefix="/agent", tags=["agent"])

class ChatRequest(BaseModel):
    agentCode: str = Field(..., description="智能体标识")
    text: str = Field(..., description="对话文本")
    files: str = Field(default="", description="文件URL列表")
    thinking: Optional[bool] = Field(default=None, description="是否启用思考模式")
    sessionId: Optional[str] = Field(None, description="会话ID")
    memory: Optional[bool] = Field(
        None,
        description="本次请求是否允许使用记忆；最终仍受用户账户记忆开关约束",
    )
    skill: Optional[str] = Field(None, description="显式指定 python/skills 下的技能名")
    skills: List[str] = Field(default_factory=list, description="本轮强制执行的技能列表")
    outputFormat: Optional[str] = Field(
        None,
        description="产物格式，例如 docx；也可由技能自动决定",
    )

class ApiResponse(BaseModel):
    code: int = Field(0, description="状态码：0-成功，非0-失败")
    message: str = Field("success", description="提示信息")
    data: Optional[Any] = Field(None, description="响应数据")

async def chat_generator(request: ChatRequest, username: str):
    config = AgentService.get_agent_config(request.agentCode)
    if not config:
        yield f'data: {json.dumps({"event": "error", "done": True, "error": "智能体不存在或已下线"}, ensure_ascii=False)}\n\n'
        return
    request = request.model_copy(deep=True)
    request.thinking = bool(config.get("support_think") and
        (config.get("default_think", False) if request.thinking is None else request.thinking))
    versions = {"agentVersion": config.get("config_version"), "workflowVersion": config.get("workflowVersion")}
    full_content = ""
    full_think_message = ""
    knowledge_data = []
    artifacts = []
    nodes = {}
    terminal_status = "running"
    terminal_error = None
    history_context = None
    effective_session_id = request.sessionId or str(uuid.uuid4())
    if username:
        history_context = start_history_record(
            session_id=effective_session_id,
            username=username,
            agent_code=request.agentCode,
            request_data=request.model_dump(),
        )
        effective_session_id = history_context["session_id"]
    try:
        async for chunk in AgentService.chat_stream(
            agent_code=request.agentCode,
            text=request.text,
            files=request.files,
            thinking=request.thinking,
            session_id=effective_session_id,
            username=username,
            memory=request.memory,
            skill=request.skill,
            skills=request.skills,
            output_format=request.outputFormat,
            config=config,
        ):
            chunk_data = json.loads(chunk)
            full_content += chunk_data.get('content', '')
            full_think_message += chunk_data.get('thinkMessage', '')
            chunk_knowledge = chunk_data.get('knowledge', [])
            if isinstance(chunk_knowledge, list) and chunk_knowledge:
                knowledge_data = chunk_knowledge
            chunk_artifacts = chunk_data.get('artifacts', [])
            if isinstance(chunk_artifacts, list) and chunk_artifacts:
                artifacts = chunk_artifacts
            node = chunk_data.get("node")
            if isinstance(node, dict) and node.get("id"):
                existing = nodes.get(node["id"], {})
                nodes[node["id"]] = {
                    **existing,
                    **node,
                    "details": {
                        **existing.get("details", {}),
                        **node.get("details", {}),
                    },
                }
            if chunk_data.get("event") == "error":
                terminal_status = "error"
                terminal_error = chunk_data.get("error")
            elif chunk_data.get("done"):
                terminal_status = "complete"

            if chunk_data.get("done") or chunk_data.get("event") == "error":
                snapshot = {
                    **versions,
                    "key": history_context["assistant_id"]
                    if history_context
                    else f"assistant-{uuid.uuid4().hex}",
                    "role": "assistant",
                    "content": full_content,
                    "thinkMessage": full_think_message,
                    "agentCode": request.agentCode,
                    "agentName": chunk_data.get("agentName", ""),
                    "nodes": list(nodes.values()),
                    "knowledge": knowledge_data,
                    "artifacts": artifacts,
                    "skills": chunk_data.get("skills", request.skills),
                    "thinking": request.thinking,
                    "status": terminal_status,
                    "complete": True,
                    "error": terminal_error,
                }
                if history_context and username:
                    finalize_history_record(
                        effective_session_id,
                        username,
                        history_context["assistant_id"],
                        snapshot,
                    )
                chunk_data["message"] = snapshot
                chunk_data["sessionId"] = effective_session_id
                yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
            else:
                yield f"data: {chunk}\n\n"
    finally:
        if terminal_status == "running" and history_context and username:
            finalize_history_record(
                effective_session_id,
                username,
                history_context["assistant_id"],
                {
                    **versions,
                    "content": full_content,
                    "thinkMessage": full_think_message,
                    "nodes": list(nodes.values()),
                    "knowledge": knowledge_data,
                    "artifacts": artifacts,
                    "skills": request.skills,
                    "thinking": request.thinking,
                    "status": "cancelled",
                    "error": "请求已取消",
                },
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
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )

@router.get("/list", response_model=ApiResponse, summary="获取智能体列表")
async def get_agent_list():
    return AgentService.get_agent_list()

@router.get("/skills", response_model=ApiResponse, summary="获取可用技能列表")
async def get_skill_list():
    from services.skill_service import SkillService

    skills = SkillService.load_skills(refresh=True)
    return {
        "code": 0,
        "message": "success",
        "data": [
            {
                "name": item.name,
                "description": item.description,
                "fileExtensions": item.file_extensions,
                "artifact": item.artifact,
            }
            for item in skills.values()
        ],
    }
