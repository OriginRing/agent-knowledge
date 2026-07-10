import os
import json
import requests
from typing import Dict, Any, List

def _make_request(endpoint: str, **kwargs) -> Dict[str, Any]:
    MEMOS_API_KEY = os.getenv("MEMOS_API_KEY")
    MEMOS_BASE_URL = os.getenv("MEMOS_BASE_URL")

    url = f"{MEMOS_BASE_URL}{endpoint}"

    headers = {
        "Authorization": f"Token {MEMOS_API_KEY}",
        "Content-Type": "application/json",
    }

    try:
        response = requests.post(url=url, headers=headers, **kwargs)
        response.raise_for_status()
        return {'code': 0, 'message': 'success', 'data': response.json()}
    except requests.exceptions.RequestException as e:
        try:
            error_data = response.json()
            error_msg = error_data.get('message', str(e))
        except:
            error_msg = str(e)
        return {'code': -1, 'message': f'Memos API调用失败: {error_msg}'}

def add_memory(user_id: str, conversation_id: str, messages: List[Dict[str, str]]) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "messages": messages
    }
    print(data)
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
    print(data)
    return _make_request("/get/memory", data=json.dumps(data))

def delete_memory(memo_id: str) -> Dict[str, Any]:
    data = {
        "memory_ids": [memo_id]
    }
    print(data)
    return _make_request("/delete/memory", data=json.dumps(data))

def update_memory(feedback_content: str, conversation_id: str, user_id: str) -> Dict[str, Any]:
    data = {
        "user_id": user_id,
        "conversation_id": conversation_id,
        "feedback_content": feedback_content
    }
    print(data)
    return _make_request("/add/feedback", data=json.dumps(data))