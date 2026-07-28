import os
import json
import requests
from typing import Dict, Any, List, Optional
from db.sqlalchemy_connection import get_session
from models.db_models import User

def _make_request(endpoint: str, **kwargs) -> Dict[str, Any]:
    api_key = os.getenv("MEMOS_API_KEY")
    base_url = os.getenv("MEMOS_BASE_URL")
    if not api_key or not base_url:
        return {'code': -1, 'message': 'Memos 配置不完整'}

    url = f"{base_url.rstrip('/')}{endpoint}"

    headers = {
        "Authorization": f"Token {api_key}",
        "Content-Type": "application/json",
    }

    response = None
    try:
        response = requests.post(
            url=url,
            headers=headers,
            timeout=float(os.getenv("MEMOS_TIMEOUT", "15")),
            **kwargs,
        )
        response.raise_for_status()
        return {'code': 0, 'message': 'success', 'data': response.json()}
    except requests.exceptions.RequestException as e:
        try:
            error_data = response.json() if response is not None else {}
            error_msg = error_data.get('message', str(e))
        except (ValueError, AttributeError):
            error_msg = str(e)
        return {'code': -1, 'message': f'Memos API调用失败: {error_msg}'}

def add_memory(user_id: str, conversation_id: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "messages": messages
    }
    return _make_request("/add/message", data=json.dumps(data))

def search_memory(user_id: str, conversation_id: str, query: str) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "query": query
    }
    return _make_request("/search/memory", data=json.dumps(data))

def list_memories(user_id: str, page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "page": page,
        "page_size": page_size
    }
    return _make_request("/get/memory", data=json.dumps(data))

def delete_memory(memo_id: str) -> Dict[str, Any]:
    data = {
        "memory_ids": [memo_id]
    }
    return _make_request("/delete/memory", data=json.dumps(data))

def update_memory(feedback_content: str, conversation_id: str, user_id: str) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "feedback_content": feedback_content
    }
    return _make_request("/add/feedback", data=json.dumps(data))


def is_memory_enabled(username: Optional[str]) -> bool:
    """用户表中的开关是 Chat 是否使用记忆的服务端权威来源。"""
    if not username:
        return False
    session = None
    try:
        session = get_session('agent-user')
        user = session.query(User).filter_by(username=username).first()
        return bool(user and user.memory)
    except Exception as exc:
        print(f"[MemoryService] 读取记忆开关失败: {exc}")
        return False
    finally:
        if session:
            session.close()


def _collect_memory_values(value: Any, output: List[str]) -> None:
    if isinstance(value, dict):
        for key in ("memory_value", "memory", "content", "text"):
            item = value.get(key)
            if isinstance(item, str) and item.strip():
                output.append(item.strip())
        for key, item in value.items():
            if key not in {"memory_value", "memory", "content", "text"}:
                _collect_memory_values(item, output)
    elif isinstance(value, list):
        for item in value:
            _collect_memory_values(item, output)


def format_memory_context(result: Dict[str, Any], max_chars: int = 6000) -> str:
    """兼容 Memos 搜索接口的多层 data 返回结构，生成可注入的纯文本。"""
    if result.get("code") != 0:
        return ""
    values: List[str] = []
    _collect_memory_values(result.get("data"), values)
    unique_values = list(dict.fromkeys(values))
    context = "\n".join(f"- {item}" for item in unique_values)
    return context[:max_chars]
