import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db.sqlalchemy_connection import get_session
from models.db_models import History


SCHEMA_VERSION = 2


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _normalize_message(record: Dict[str, Any], index: int) -> Dict[str, Any]:
    role = record.get("role", "user")
    raw_nodes = record.get("nodes", record.get("steps", []))
    artifacts = record.get("artifacts", [])
    nodes = []
    for node_index, node in enumerate(raw_nodes):
        if not isinstance(node, dict):
            continue
        legacy_status = node.get("status", "success")
        nodes.append(
            {
                "id": node.get("id", f"legacy-node-{index}-{node_index}"),
                "kind": node.get("kind", "pipeline"),
                "name": node.get("name", "step"),
                "title": node.get("title", node.get("message", node.get("name", "处理步骤"))),
                "summary": node.get("summary", node.get("message", node.get("name", "处理步骤"))),
                "status": {
                    "started": "running",
                    "completed": "success",
                    "failed": "error",
                }.get(legacy_status, legacy_status),
                "details": node.get("details", {}),
                "fileUrl": node.get("fileUrl", ""),
                "startedAt": node.get("startedAt"),
                "finishedAt": node.get("finishedAt"),
            }
        )
    if role == "assistant" and artifacts and not any(
        node.get("kind") == "file" for node in nodes
    ):
        files = [
            {
                "fileUrl": artifact.get("url", artifact.get("fileUrl", "")),
                "fileName": artifact.get("name", artifact.get("fileName", "生成文件")),
                "format": artifact.get("format", ""),
                "mimeType": artifact.get("mimeType", ""),
                "size": artifact.get("size", 0),
            }
            for artifact in artifacts
            if isinstance(artifact, dict)
            and artifact.get("url", artifact.get("fileUrl"))
        ]
        if files:
            nodes.append(
                {
                    "id": f"legacy-file-node-{index}",
                    "kind": "file",
                    "name": "artifact_generator",
                    "title": "生成文件",
                    "summary": f"已生成 {len(files)} 个文件",
                    "status": "success",
                    "fileUrl": ",".join(item["fileUrl"] for item in files),
                    "details": {"files": files, "errors": []},
                    "startedAt": None,
                    "finishedAt": record.get("finishedAt"),
                }
            )
    return {
        "key": str(record.get("key") or f"legacy-{index}"),
        "role": role,
        "content": record.get("content", ""),
        "files": record.get("files", ""),
        "thinkMessage": record.get("thinkMessage", ""),
        "agentCode": record.get("agentCode", ""),
        "agentName": record.get("agentName", ""),
        "thinking": False,
        "knowledgeSkill": record.get("knowledgeSkill", False),
        "connectSkill": record.get("connectSkill", False),
        "knowledge": record.get("knowledge", []),
        "nodes": nodes,
        "artifacts": artifacts,
        "skills": record.get("skills", []),
        "status": record.get("status", "complete"),
        "complete": record.get("complete", True),
        "error": record.get("error"),
        "createdAt": record.get("createdAt", record.get("timestamp", _now())),
    }


def normalize_history_payload(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, dict) and raw.get("schemaVersion") == SCHEMA_VERSION:
        messages = raw.get("messages", [])
    elif isinstance(raw, list):
        messages = raw
    else:
        messages = []
    return {
        "schemaVersion": SCHEMA_VERSION,
        "messages": [
            _normalize_message(message, index)
            for index, message in enumerate(messages)
            if isinstance(message, dict)
        ],
    }


def _load_payload(history: Optional[History]) -> Dict[str, Any]:
    if not history:
        return {"schemaVersion": SCHEMA_VERSION, "messages": []}
    try:
        return normalize_history_payload(json.loads(history.records))
    except (TypeError, ValueError, json.JSONDecodeError):
        return {"schemaVersion": SCHEMA_VERSION, "messages": []}


def start_history_record(
    session_id: Optional[str],
    username: str,
    agent_code: str,
    request_data: Dict[str, Any],
) -> Dict[str, str]:
    session_id = session_id or str(uuid.uuid4())
    assistant_id = f"assistant-{uuid.uuid4().hex}"
    session = None
    try:
        session = get_session("agent-user")
        history = (
            session.query(History)
            .filter_by(session_id=session_id, username=username)
            .first()
        )
        payload = _load_payload(history)
        created_at = _now()
        user_message = {
            "key": f"user-{uuid.uuid4().hex}",
            "role": "user",
            "content": request_data.get("text", ""),
            "files": request_data.get("files", ""),
            "skills": request_data.get("skills", []),
            "thinking": request_data.get("thinking", False),
            "knowledgeSkill": request_data.get("knowledge", False),
            "connectSkill": request_data.get("connect", False),
            "status": "complete",
            "complete": True,
            "createdAt": created_at,
        }
        assistant_message = {
            "key": assistant_id,
            "role": "assistant",
            "content": "",
            "thinkMessage": "",
            "agentCode": agent_code,
            "agentName": "",
            "nodes": [],
            "knowledge": [],
            "artifacts": [],
            "skills": request_data.get("skills", []),
            "status": "running",
            "complete": False,
            "createdAt": created_at,
        }
        payload["messages"].extend([user_message, assistant_message])
        encoded = json.dumps(payload, ensure_ascii=False)
        if history:
            history.records = encoded
            history.agent_code = agent_code
        else:
            history = History(
                session_id=session_id,
                username=username,
                agent_code=agent_code,
                records=encoded,
            )
            session.add(history)
        session.commit()
        return {"session_id": session_id, "assistant_id": assistant_id}
    finally:
        if session:
            session.close()


def finalize_history_record(
    session_id: str,
    username: str,
    assistant_id: str,
    response_data: Dict[str, Any],
) -> Dict[str, Any]:
    session = None
    try:
        session = get_session("agent-user")
        history = (
            session.query(History)
            .filter_by(session_id=session_id, username=username)
            .first()
        )
        if not history:
            return {"code": 1, "message": "历史会话不存在"}
        payload = _load_payload(history)
        target = next(
            (
                message
                for message in payload["messages"]
                if message.get("key") == assistant_id
            ),
            None,
        )
        if not target:
            return {"code": 1, "message": "历史消息不存在"}
        target.update(
            {
                "agentVersion": response_data.get("agentVersion"),
                "workflowVersion": response_data.get("workflowVersion"),
                "content": response_data.get("content", ""),
                "thinkMessage": response_data.get("thinkMessage", ""),
                "agentName": response_data.get("agentName", ""),
                "nodes": response_data.get("nodes", []),
                "knowledge": response_data.get("knowledge", []),
                "artifacts": response_data.get("artifacts", []),
                "skills": response_data.get("skills", []),
                "knowledgeSkill": response_data.get("knowledgeSkill", False),
                "connectSkill": response_data.get("connectSkill", False),
                "thinking": response_data.get("thinking", False),
                "status": response_data.get("status", "complete"),
                "complete": response_data.get("status", "complete") != "running",
                "error": response_data.get("error"),
                "finishedAt": _now(),
            }
        )
        history.records = json.dumps(payload, ensure_ascii=False)
        session.commit()
        return {"code": 0, "message": "success", "data": {"session_id": session_id}}
    except Exception as exc:
        if session:
            session.rollback()
        return {"code": -1, "message": f"保存历史记录失败: {exc}"}
    finally:
        if session:
            session.close()


def add_history_record(
    session_id: str,
    username: str,
    agent_code: str,
    request_data: dict,
    response_data: dict,
):
    started = start_history_record(session_id, username, agent_code, request_data)
    return finalize_history_record(
        started["session_id"],
        username,
        started["assistant_id"],
        {
            **response_data,
            "nodes": response_data.get("nodes", response_data.get("steps", [])),
            "status": "complete",
        },
    )


def get_history_list(username: str, agent_code: str = None):
    session = None
    try:
        session = get_session("agent-user")
        query = session.query(History).filter_by(username=username)
        if agent_code:
            query = query.filter_by(agent_code=agent_code)
        histories = query.order_by(History.updated_at.desc()).all()
        result: List[Dict[str, Any]] = []
        for history in histories:
            payload = _load_payload(history)
            messages = payload["messages"]
            if not messages:
                continue
            first_user = next(
                (message for message in messages if message["role"] == "user"),
                messages[0],
            )
            first_assistant = next(
                (message for message in messages if message["role"] == "assistant"),
                {},
            )
            result.append(
                {
                    "id": history.id,
                    "session_id": history.session_id,
                    "agent_code": history.agent_code,
                    "preview": first_user.get("content", "")[:50],
                    "content": first_assistant.get("content", "")[:50],
                    "record_count": len(messages),
                    "created_at": str(history.created_at),
                    "updated_at": str(history.updated_at),
                }
            )
        return {"code": 0, "message": "success", "data": result}
    except Exception as exc:
        return {"code": -1, "message": f"获取历史记录失败: {exc}"}
    finally:
        if session:
            session.close()


def get_history_detail(
    username: str,
    history_id: int = None,
    session_id: str = None,
):
    session = None
    try:
        session = get_session("agent-user")
        if history_id:
            history = (
                session.query(History)
                .filter_by(id=history_id, username=username)
                .first()
            )
        elif session_id:
            history = (
                session.query(History)
                .filter_by(session_id=session_id, username=username)
                .first()
            )
        else:
            return {"code": 1, "message": "请提供id或sessionId"}
        if not history:
            return {"code": 1, "message": "会话不存在"}
        payload = _load_payload(history)
        return {
            "code": 0,
            "message": "success",
            "data": {
                "id": history.id,
                "schemaVersion": SCHEMA_VERSION,
                "session_id": history.session_id,
                "agent_code": history.agent_code,
                "records": payload["messages"],
                "created_at": str(history.created_at),
                "updated_at": str(history.updated_at),
            },
        }
    except Exception as exc:
        return {"code": -1, "message": f"获取历史详情失败: {exc}"}
    finally:
        if session:
            session.close()


def delete_history_record(history_id: int, agent_code: str, username: str):
    session = None
    try:
        session = get_session("agent-user")
        history = (
            session.query(History)
            .filter_by(id=history_id, agent_code=agent_code, username=username)
            .first()
        )
        if not history:
            return {"code": 1, "message": "记录不存在或权限不足"}
        session.delete(history)
        session.commit()
        return {"code": 0, "message": "success"}
    except Exception as exc:
        if session:
            session.rollback()
        return {"code": -1, "message": f"删除历史记录失败: {exc}"}
    finally:
        if session:
            session.close()
