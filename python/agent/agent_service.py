import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Dict, List, Optional

from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from openai import AsyncOpenAI

from db.sqlalchemy_connection import get_session
from models.db_models import AgentList

load_dotenv()

def web_search(query: str) -> str:
    try:
        from services.search_service import SearchService

        return SearchService.search(query).get("context", "未找到相关信息")
    except Exception as exc:
        return f"搜索错误: {exc}"


def retrieve_knowledge(query: str):
    try:
        from services.knowledge_service import KnowledgeService

        result = KnowledgeService.search_knowledge(query, k=3, format="text")
        return result["knowledge_text"], result["knowledge_items"]
    except Exception as exc:
        print(f"知识库检索错误: {exc}")
        return "", []


class AgentService:
    _models: Dict[str, Any] = {}

    @classmethod
    def get_agent_config(cls, agent_code):
        from services.admin_service import published_config
        published = published_config(agent_code)
        if published:
            return None if published.get("disabled") else published
        session = None
        try:
            session = get_session("agent-knowledge")
            agent = (
                session.query(AgentList)
                .filter_by(agentcode=agent_code, status=1)
                .first()
            )
            if not agent:
                return None
            return {
                "id": agent.id,
                "agent_code": agent.agentcode,
                "agent_name": agent.agentname,
                "model_type": agent.model_type,
                "model_name": agent.model_name,
                "api_key_name": agent.api_key_name,
                "base_url": agent.base_url,
                "default_skill": agent.default_skill,
                "status": agent.status,
                "description": agent.description,
                "is_default": agent.is_default,
                "support_file": agent.support_file,
                "support_think": agent.support_think,
                "support_connect": agent.support_connect,
                "support_knowledge": agent.support_knowledge,
                "support_download": agent.support_download,
            }
        except Exception as exc:
            print(f"获取 agent 配置失败: {exc}")
            return None
        finally:
            if session:
                session.close()

    @classmethod
    def get_model(cls, agent_code, reasoning=False, config=None):
        config = config or cls.get_agent_config(agent_code)
        cache_key = f"{agent_code}_{reasoning}_{(config or {}).get('config_version', 0)}"
        if cache_key in cls._models:
            return cls._models[cache_key]

        if not config:
            raise ValueError(f"agent_code 不存在或已禁用: {agent_code}")

        if config["model_type"] == "api":
            api_key = os.getenv(config["api_key_name"])
            if not api_key:
                raise ValueError(f"API密钥未配置: {config['api_key_name']}")
            model = AsyncOpenAI(api_key=api_key, base_url=config["base_url"])
        elif config["model_type"] == "ollama":
            model = ChatOllama(
                model=config["model_name"],
                streaming=True,
                reasoning=reasoning,
                base_url=config.get("base_url") or "http://127.0.0.1:11434",
            )
        else:
            raise ValueError(f"不支持的模型类型: {config['model_type']}")

        if not str(config.get("config_version", "")).startswith("draft-"):
            cls._models[cache_key] = model
        return model

    @classmethod
    def _get_thinking_kwargs(cls, base_url, model_name, thinking):
        base_url = base_url or ""
        model_name = model_name or ""
        if not thinking:
            return (
                {"extra_body": {"enable_thinking": False}}
                if "dashscope" in base_url
                else {}
            )
        if "dashscope" in base_url:
            return {"extra_body": {"enable_thinking": True}}
        if "deepseek" in base_url:
            return {"extra_body": {"thinking": {"type": "enabled"}}}
        if "openai" in base_url:
            if "o1" in model_name.lower():
                return {"reasoning": {"effort": "high"}}
            return {"extra_body": {"reasoning": {"effort": "high"}}}
        return {}

    @staticmethod
    def _dump(payload: Dict[str, Any]) -> str:
        return json.dumps(payload, ensure_ascii=False)

    @classmethod
    def _event(
        cls,
        config: Optional[Dict[str, Any]],
        *,
        event: str,
        content: str = "",
        think_message: str = "",
        done: bool = False,
        step: Optional[Dict[str, Any]] = None,
        knowledge: Optional[List[Dict[str, Any]]] = None,
        artifacts: Optional[List[Dict[str, Any]]] = None,
        file_url: Optional[str] = None,
        error: Optional[str] = None,
        thinking: bool = False,
        connect: bool = False,
        memory: bool = False,
        skill: Optional[str] = None,
        skills: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "event": event,
            "content": content,
            "thinkMessage": think_message,
            "agentCode": config.get("agent_code", "") if config else "",
            "agentName": config.get("agent_name", "") if config else "",
            "thinking": thinking,
            "connect": connect,
            "memory": memory,
            "skill": skill,
            "skills": skills or ([skill] if skill else []),
            "done": done,
        }
        if step is not None:
            payload["step"] = step
        if knowledge is not None:
            payload["knowledge"] = knowledge
        if artifacts is not None:
            payload["artifacts"] = artifacts
        if file_url is not None:
            payload["fileUrl"] = file_url
        if error is not None:
            payload["error"] = error
        return payload

    @classmethod
    def _step(
        cls,
        config: Optional[Dict[str, Any]],
        name: str,
        status: str,
        message: str,
        **context,
    ) -> Dict[str, Any]:
        details = context.pop("details", None)
        node_id = context.pop("node_id", name.replace("_", "-"))
        node_kind = context.pop("node_kind", "pipeline")
        file_url = context.pop("file_url", None)
        normalized_status = {
            "started": "running",
            "completed": "success",
            "failed": "error",
        }.get(status, status)
        now = datetime.now(timezone.utc).isoformat()
        step = {"name": name, "status": status, "message": message}
        if details is not None:
            step["details"] = details
        node = {
            "id": node_id,
            "kind": node_kind,
            "name": name,
            "title": message,
            "status": normalized_status,
            "summary": message,
            "details": details or {},
        }
        if normalized_status == "running":
            node["startedAt"] = now
        else:
            node["finishedAt"] = now
        if file_url is not None:
            node["fileUrl"] = file_url
        payload = cls._event(
            config, event="node", step=step, file_url=file_url, **context
        )
        payload["node"] = node
        return payload

    @classmethod
    async def chat_stream(
        cls,
        agent_code,
        text,
        files=None,
        thinking=None,
        knowledge=None,
        connect=None,
        session_id=None,
        username=None,
        memory: Optional[bool] = None,
        skill: Optional[str] = None,
        skills: Optional[List[str]] = None,
        output_format: Optional[str] = None,
        config=None,
    ):
        if isinstance(files, str):
            files = [item.strip() for item in files.split(",") if item.strip()]
        else:
            files = files or []

        config = config or cls.get_agent_config(agent_code)
        if not config:
            yield cls._dump(
                cls._event(
                    None,
                    event="error",
                    done=True,
                    error=f"agent_code 不存在或已禁用: {agent_code}",
                )
            )
            return

        if config.get("workflow"):
            from services.workflow_runtime import stream_workflow
            async for event in stream_workflow(config, text=text, files=files, username=username,
                    session_id=session_id, thinking=thinking, knowledge=knowledge, connect=connect, memory=memory):
                yield cls._dump(event)
            return
        thinking = config.get("default_think", False) if thinking is None else thinking
        knowledge = config.get("default_knowledge", False) if knowledge is None else knowledge
        connect = config.get("default_connect", False) if connect is None else connect
        actual_thinking = bool(thinking and config.get("support_think"))
        requested_skills = set(skills or [])
        if knowledge:
            requested_skills.add("knowledge-search")
        if connect:
            requested_skills.add("web-search")
        if skill:
            requested_skills.add(skill)
        actual_knowledge = bool(
            "knowledge-search" in requested_skills and config.get("support_knowledge")
        )
        actual_connect = bool(
            "web-search" in requested_skills and config.get("support_connect")
        )
        if not actual_knowledge:
            requested_skills.discard("knowledge-search")
        if not actual_connect:
            requested_skills.discard("web-search")
        actual_file = bool(files and config.get("support_file"))
        common = {
            "thinking": actual_thinking,
            "connect": actual_connect,
            "memory": False,
            "skill": None,
            "skills": sorted(requested_skills),
        }

        yield cls._dump(
            cls._step(config, "request", "completed", "请求已接收并完成参数校验", **common)
        )

        try:
            from services.skill_service import SkillService

            requested_prompt_skill = skill if skill and skill not in {
                "file-reader", "web-search", "knowledge-search", "artifact-generator"
            } else None
            intent_skill = SkillService.select_skill(
                text,
                files,
                requested_skill=requested_prompt_skill,
                agent_code=agent_code,
            )
            selected_skills = {}
            default_skill_name = config.get("default_skill")
            if default_skill_name:
                default_skill = SkillService.get_skill(default_skill_name)
                SkillService.ensure_agent_allowed(default_skill, agent_code)
                selected_skills[default_skill.name] = default_skill
            if intent_skill:
                selected_skills[intent_skill.name] = intent_skill
            for selected in selected_skills.values():
                if selected.file_extensions and files and not actual_file:
                    raise ValueError(
                        f"当前智能体不支持文件输入，无法执行技能：{selected.name}"
                    )
            ordered_skills = sorted(
                selected_skills.values(),
                key=lambda item: (item.order, item.name),
            )
            selected_skill_names = [item.name for item in ordered_skills]
            common["skill"] = selected_skill_names[0] if selected_skill_names else None
            enabled_skill_names = set(requested_skills)
            enabled_skill_names.update(selected_skill_names)
            if files:
                enabled_skill_names.add("file-reader")
            artifact_formats = SkillService.detect_artifact_formats(
                text, output_format
            )
            if not config.get("support_download", True):
                artifact_formats = []
            if not artifact_formats:
                for selected in ordered_skills:
                    if selected.artifact:
                        artifact_formats = SkillService.detect_artifact_formats(
                            "", selected.artifact
                        )
                        if artifact_formats:
                            break
            if artifact_formats:
                enabled_skill_names.add("artifact-generator")
            common["skills"] = sorted(enabled_skill_names)
            yield cls._dump(
                cls._step(
                    config,
                    "skill",
                    "completed" if enabled_skill_names else "skipped",
                    f"已启用技能：{selected_skill_names[0]}"
                    if len(selected_skill_names) == 1
                    and len(enabled_skill_names) == 1
                    else f"已启用 {len(enabled_skill_names)} 个技能"
                    if enabled_skill_names
                    else "未匹配到需要执行的技能",
                    details={"skills": sorted(enabled_skill_names)},
                    node_kind="skill",
                    **common,
                )
            )

            system_messages: List[Dict[str, str]] = ([{"role": "system", "content": config["system_prompt"]}] if config.get("system_prompt") else [])
            for selected in ordered_skills:
                if (
                    selected.kind == "hybrid"
                    and selected.entrypoint
                    and default_skill_name
                ):
                    continue
                if selected.prompt:
                    system_messages.append(
                        {"role": "system", "content": selected.prompt}
                    )

            if artifact_formats and default_skill_name != "sales-performance":
                format_prompts = {
                    "xlsx": "请使用 Markdown 表格组织需要写入 Excel 的数据，每个一级或二级标题对应一个工作表。",
                    "pptx": "请使用 Markdown 标题划分幻灯片，每页使用简洁的要点列表。",
                    "pdf": "请输出结构清晰、标题层级明确的 Markdown 正式文档。",
                    "docx": "请输出结构清晰、标题层级明确的 Markdown 文档。",
                }
                system_messages.extend(
                    {
                        "role": "system",
                        "content": format_prompts[artifact_format],
                    }
                    for artifact_format in artifact_formats
                )

            from services.memory_service import (
                format_memory_context,
                is_memory_enabled,
                search_memory,
            )

            user_memory_enabled = await asyncio.to_thread(is_memory_enabled, username)
            memory_enabled = bool(user_memory_enabled and memory is not False)
            common["memory"] = memory_enabled
            if memory_enabled:
                yield cls._dump(
                    cls._step(config, "memory_lookup", "started", "正在检索相关长期记忆", **common)
                )
                memory_result = await asyncio.to_thread(
                    search_memory, username, session_id, text
                )
                memory_context = format_memory_context(memory_result)
                if memory_context:
                    system_messages.append(
                        {
                            "role": "system",
                            "content": (
                                "以下是与当前用户相关的长期记忆。仅在与本次问题有关时使用，"
                                "不得把记忆内容误称为本轮用户刚刚提供的信息：\n"
                                f"{memory_context}"
                            ),
                        }
                    )
                yield cls._dump(
                    cls._step(
                        config,
                        "memory_lookup",
                        "completed",
                        "长期记忆检索完成"
                        if memory_context
                        else "未检索到相关长期记忆",
                        details={"injected": bool(memory_context)},
                        node_kind="memory",
                        **common,
                    )
                )
            else:
                yield cls._dump(
                    cls._step(
                        config,
                        "memory_lookup",
                        "skipped",
                        "当前用户未开启记忆",
                        **common,
                    )
                )

            history_messages: List[Dict[str, str]] = []
            if session_id and username:
                yield cls._dump(
                    cls._step(config, "history", "started", "正在加载会话历史", **common)
                )
                from agent.history_manager import HistoryManager

                history_messages = await asyncio.to_thread(
                    HistoryManager.get_history_messages,
                    username,
                    session_id,
                    max_tokens=int(os.getenv("MAX_TOKENS", "4096")),
                )
                yield cls._dump(
                    cls._step(
                        config,
                        "history",
                        "completed",
                        "会话历史加载完成",
                        details={"messageCount": len(history_messages)},
                        node_kind="history",
                        **common,
                    )
                )
            else:
                yield cls._dump(
                    cls._step(config, "history", "skipped", "无需加载会话历史", **common)
                )

            knowledge_items: List[Dict[str, Any]] = []
            parsed_files: List[Dict[str, Any]] = []
            processed_files: List[Dict[str, Any]] = []
            structured_data: Dict[str, Any] = {}
            presentation_content = ""
            artifact_source_content = ""
            if actual_file:
                yield cls._dump(
                    cls._step(
                        config,
                        "file_reader",
                        "started",
                        f"正在解析 {len(files)} 个文件",
                        node_id="skill-file-reader",
                        node_kind="skill",
                        **common,
                    )
                )
                try:
                    file_result = await asyncio.to_thread(
                        SkillService.execute,
                        "file-reader",
                        query=text,
                        files=files,
                    )
                    parsed_files = file_result.get("files", [])
                    if file_result.get("context") and config["model_type"] != "api":
                        system_messages.append(
                            {
                                "role": "system",
                                "content": file_result["context"],
                            }
                        )
                    if config["model_type"] == "api":
                        for item in parsed_files:
                            if item.get("isImage"):
                                processed_files.append(
                                    {
                                        "type": "image_url",
                                        "image_url": {"url": item["url"]},
                                    }
                                )
                            if item.get("content"):
                                processed_files.append(
                                    {
                                        "type": "text",
                                        "text": (
                                            f"【{item['filename']} 解析内容】\n"
                                            f"{item['content']}"
                                        ),
                                    }
                                )
                    file_status = (
                        "completed"
                        if any(
                            item.get("status") in {"success", "partial"}
                            for item in parsed_files
                        )
                        else "failed"
                    )
                    yield cls._dump(
                        cls._step(
                            config,
                            "file_reader",
                            file_status,
                            "文件解析完成"
                            if file_status == "completed"
                            else "文件解析未获得有效内容",
                            details={"files": parsed_files},
                            node_id="skill-file-reader",
                            node_kind="skill",
                            **common,
                        )
                    )
                except Exception as exc:
                    yield cls._dump(
                        cls._step(
                            config,
                            "file_reader",
                            "failed",
                            f"文件解析失败：{exc}",
                            details={"files": parsed_files},
                            node_id="skill-file-reader",
                            node_kind="skill",
                            **common,
                        )
                    )
            elif files:
                yield cls._dump(
                    cls._step(
                        config,
                        "file_reader",
                        "skipped",
                        "当前智能体不支持文件输入",
                        node_id="skill-file-reader",
                        node_kind="skill",
                        **common,
                    )
                )

            business_skills = [
                selected
                for selected in ordered_skills
                if selected.entrypoint
                and selected.name
                not in {
                    "file-reader",
                    "web-search",
                    "knowledge-search",
                    "artifact-generator",
                }
            ]
            for business_skill in business_skills:
                if business_skill.kind == "hybrid" and not structured_data:
                    continue
                node_id = f"skill-{business_skill.name}"
                title = business_skill.description or business_skill.name
                yield cls._dump(
                    cls._step(
                        config,
                        business_skill.name.replace("-", "_"),
                        "started",
                        f"正在执行{title}",
                        node_id=node_id,
                        node_kind="skill",
                        **common,
                    )
                )
                try:
                    result = await asyncio.to_thread(
                        SkillService.execute,
                        business_skill.name,
                        agent_code=agent_code,
                        query=text,
                        files=files,
                        requester_username=username,
                        upstream_data=structured_data,
                    )
                    result_data = result.get("data")
                    if isinstance(result_data, dict):
                        structured_data = result_data
                    if result.get("presentation"):
                        presentation_content = str(result["presentation"])
                    if result.get("artifactContent"):
                        artifact_source_content = str(result["artifactContent"])
                    context_text = result.get("context", "")
                    if context_text:
                        system_messages.append(
                            {
                                "role": "system",
                                "content": (
                                    f"【{business_skill.name} 结果】\n"
                                    f"{context_text}"
                                ),
                            }
                        )
                    node_details = {
                        "status": result.get("status", "success"),
                        "summary": result.get("summary", ""),
                    }
                    if isinstance(result_data, dict):
                        node_details["data"] = result_data
                    yield cls._dump(
                        cls._step(
                            config,
                            business_skill.name.replace("-", "_"),
                            "completed",
                            result.get("summary") or f"{title}完成",
                            details=node_details,
                            node_id=node_id,
                            node_kind="skill",
                            **common,
                        )
                    )
                    if result.get("stopPipeline"):
                        direct_response = str(
                            result.get("directResponse") or "请求无法继续处理"
                        )
                        yield cls._dump(
                            cls._event(
                                config,
                                event="message",
                                content=direct_response,
                                **common,
                            )
                        )
                        yield cls._dump(
                            cls._event(
                                config,
                                event="done",
                                done=True,
                                knowledge=[],
                                artifacts=[],
                                file_url="",
                                **common,
                            )
                        )
                        return
                except Exception as exc:
                    yield cls._dump(
                        cls._step(
                            config,
                            business_skill.name.replace("-", "_"),
                            "failed",
                            f"{title}失败：{exc}",
                            details={"error": str(exc)},
                            node_id=node_id,
                            node_kind="skill",
                            **common,
                        )
                    )
                    if business_skill.name == config.get("default_skill"):
                        yield cls._dump(
                            cls._event(
                                config,
                                event="message",
                                content="销售业绩查询失败，请稍后重试",
                                **common,
                            )
                        )
                        yield cls._dump(
                            cls._event(
                                config,
                                event="done",
                                done=True,
                                knowledge=[],
                                artifacts=[],
                                file_url="",
                                **common,
                            )
                        )
                        return

            for executor_name in ("web-search", "knowledge-search"):
                if executor_name not in requested_skills:
                    continue
                title = "联网搜索" if executor_name == "web-search" else "知识库检索"
                node_id = f"skill-{executor_name}"
                yield cls._dump(
                    cls._step(
                        config,
                        executor_name.replace("-", "_"),
                        "started",
                        f"正在执行{title}",
                        node_id=node_id,
                        node_kind="skill",
                        **common,
                    )
                )
                try:
                    result = await asyncio.to_thread(
                        SkillService.execute,
                        executor_name,
                        agent_code=agent_code,
                        query=text,
                        files=files,
                    )
                    context_text = result.get("context", "")
                    if context_text:
                        system_messages.append(
                            {
                                "role": "system",
                                "content": f"【{title}结果】\n{context_text}",
                            }
                        )
                    if executor_name == "knowledge-search":
                        knowledge_items = result.get("items", [])
                    yield cls._dump(
                        cls._step(
                            config,
                            executor_name.replace("-", "_"),
                            "completed",
                            f"{title}完成",
                            details=result,
                            knowledge=knowledge_items
                            if executor_name == "knowledge-search"
                            else None,
                            node_id=node_id,
                            node_kind="skill",
                            **common,
                        )
                    )
                except Exception as exc:
                    yield cls._dump(
                        cls._step(
                            config,
                            executor_name.replace("-", "_"),
                            "failed",
                            f"{title}失败：{exc}",
                            details={"error": str(exc)},
                            node_id=node_id,
                            node_kind="skill",
                            **common,
                        )
                    )

            base_messages = system_messages + history_messages
            full_content = ""
            full_think_message = ""
            if presentation_content:
                yield cls._dump(
                    cls._event(
                        config,
                        event="message",
                        content=f"{presentation_content}\n\n",
                        knowledge=knowledge_items,
                        **common,
                    )
                )
            yield cls._dump(
                cls._step(
                    config,
                    "model_call",
                    "started",
                    "开始模型调用",
                    node_id="model-call-1",
                    node_kind="model",
                    details={"model": config["model_name"]},
                    **common,
                )
            )
            if config["model_type"] == "ollama":
                model_stream = cls._chat_stream_ollama(
                    config,
                    text,
                    actual_thinking,
                    False,
                    base_messages,
                    common,
                )
            else:
                model_stream = cls._chat_stream_api(
                    config,
                    text,
                    actual_thinking,
                    False,
                    processed_files,
                    base_messages,
                    common,
                )

            try:
                async for payload in model_stream:
                    full_content += payload.get("content", "")
                    full_think_message += payload.get("thinkMessage", "")
                    if payload.get("thinkMessage"):
                        payload["node"] = {
                            "id": "model-call-1",
                            "kind": "model",
                            "name": "model_call",
                            "title": "模型正在思考",
                            "summary": "模型正在思考",
                            "status": "running",
                            "details": {
                                "model": config["model_name"],
                                "reasoning": full_think_message,
                            },
                        }
                    if payload.get("event") == "message":
                        payload["knowledge"] = knowledge_items
                    yield cls._dump(payload)
            except Exception as exc:
                if not presentation_content:
                    raise
                yield cls._dump(
                    cls._step(
                        config,
                        "model_call",
                        "failed",
                        "趋势解读生成失败，已保留精确销售结果",
                        details={"error": str(exc), "model": config["model_name"]},
                        node_id="model-call-1",
                        node_kind="model",
                        **common,
                    )
                )

            artifacts: List[Dict[str, Any]] = []
            file_url = ""
            artifact_content = artifact_source_content or full_content
            if artifact_formats and artifact_content:
                generated_files: List[Dict[str, Any]] = []
                generation_errors: List[Dict[str, str]] = []
                yield cls._dump(
                    cls._step(
                        config,
                        "artifact_generator",
                        "started",
                        f"正在生成 {len(artifact_formats)} 个文件并上传到 OSS",
                        node_id="skill-artifact-generator",
                        node_kind="file",
                        details={"files": [], "errors": []},
                        **common,
                    )
                )
                for artifact_format in artifact_formats:
                    try:
                        artifact = await asyncio.to_thread(
                            SkillService.execute,
                            "artifact-generator",
                            agent_code=agent_code,
                            content=artifact_content,
                            artifact_format=artifact_format,
                            title=(
                                f"{structured_data.get('nickname', '')}"
                                f"{structured_data.get('periodLabel', '')}销售业绩"
                                if structured_data
                                else "AI生成文件"
                            ),
                        )
                        artifacts.append(artifact)
                        generated_files.append(
                            {
                                "fileUrl": artifact["url"],
                                "fileName": artifact["name"],
                                "format": artifact["format"],
                                "mimeType": artifact["mimeType"],
                                "size": artifact["size"],
                            }
                        )
                    except Exception as exc:
                        generation_errors.append(
                            {"format": artifact_format, "error": str(exc)}
                        )

                file_url = ",".join(
                    item["fileUrl"] for item in generated_files
                )
                if artifacts:
                    yield cls._dump(
                        cls._event(
                            config,
                            event="artifact",
                            artifacts=artifacts,
                            file_url=file_url,
                            **common,
                        )
                    )

                file_status = "completed" if generated_files and not generation_errors else "failed"
                if generated_files and not generation_errors:
                    file_message = f"{len(generated_files)} 个文件已生成并上传"
                elif generated_files:
                    file_message = (
                        f"已生成 {len(generated_files)} 个文件，"
                        f"{len(generation_errors)} 个文件生成失败"
                    )
                else:
                    file_message = "文件生成或上传失败"
                yield cls._dump(
                    cls._step(
                        config,
                        "artifact_generator",
                        file_status,
                        file_message,
                        details={
                            "files": generated_files,
                            "errors": generation_errors,
                        },
                        artifacts=artifacts,
                        file_url=file_url,
                        node_id="skill-artifact-generator",
                        node_kind="file",
                        **common,
                    )
                )

            yield cls._dump(
                cls._event(
                    config,
                    event="done",
                    done=True,
                    knowledge=knowledge_items,
                    artifacts=artifacts,
                    file_url=file_url,
                    **common,
                )
            )
        except Exception as exc:
            yield cls._dump(
                cls._event(
                    config,
                    event="error",
                    error=f"对话失败: {exc}",
                    done=True,
                    **common,
                )
            )

    @classmethod
    def _process_files_for_ollama(cls, file_urls):
        from services.file_process_service import FileProcessService

        return FileProcessService.process_files_for_ollama(file_urls)

    @classmethod
    def _process_files_for_api(cls, file_urls):
        from services.file_process_service import FileProcessService

        return FileProcessService.process_files_for_api(file_urls)

    @classmethod
    async def _chat_stream_ollama(
        cls,
        config,
        text,
        thinking,
        connect,
        base_messages,
        context,
    ) -> AsyncIterator[Dict[str, Any]]:
        messages = list(base_messages)
        if connect:
            yield cls._step(
                config, "web_search", "started", "正在执行联网搜索", **context
            )
            search_result = await asyncio.to_thread(web_search, text)
            messages.append(
                {"role": "system", "content": f"联网搜索结果：\n{search_result}"}
            )
            yield cls._step(
                config, "web_search", "completed", "联网搜索完成", **context
            )

        messages.append({"role": "user", "content": text})
        model = cls.get_model(config["agent_code"], reasoning=thinking, config=config)
        async for chunk in model.astream(messages):
            yield cls._event(
                config,
                event="message",
                content=chunk.content or "",
                think_message=chunk.additional_kwargs.get("reasoning_content", ""),
                **context,
            )
        yield cls._step(
            config,
            "model_call",
            "completed",
            "模型调用完成",
            node_id="model-call-1",
            node_kind="model",
            **context,
        )

    @classmethod
    async def _chat_stream_api(
        cls,
        config,
        text,
        thinking,
        connect,
        processed_files,
        base_messages,
        context,
    ) -> AsyncIterator[Dict[str, Any]]:
        client = cls.get_model(config["agent_code"], config=config)
        messages: List[Dict[str, Any]] = list(base_messages)
        if connect:
            messages.append(
                {
                    "role": "system",
                    "content": (
                        "需要实时信息时调用 web_search 工具，并基于工具结果回答。"
                    ),
                }
            )
        if processed_files:
            content_items = list(processed_files)
            content_items.append({"type": "text", "text": text})
            messages.append({"role": "user", "content": content_items})
        else:
            messages.append({"role": "user", "content": text})

        tools = [
            {
                "type": "function",
                "function": {
                    "name": "web_search",
                    "description": "获取新闻、天气和其他实时信息",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "搜索查询词",
                            }
                        },
                        "required": ["query"],
                    },
                },
            }
        ] if connect else None

        thinking_kwargs = cls._get_thinking_kwargs(
            config["base_url"], config["model_name"], thinking
        )
        request_kwargs: Dict[str, Any] = {
            "model": config["model_name"],
            "messages": messages,
            "stream": True,
            **thinking_kwargs,
        }
        if tools:
            request_kwargs["tools"] = tools

        tool_calls: List[Dict[str, Any]] = []
        pending_content = ""
        stream = await client.chat.completions.create(**request_kwargs)
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta.tool_calls:
                for tool_call_delta in delta.tool_calls:
                    index = tool_call_delta.index or 0
                    while index >= len(tool_calls):
                        tool_calls.append(
                            {
                                "id": "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            }
                        )
                    item = tool_calls[index]
                    if tool_call_delta.id:
                        item["id"] = tool_call_delta.id
                    if tool_call_delta.function.name:
                        item["function"]["name"] = tool_call_delta.function.name
                    if tool_call_delta.function.arguments:
                        item["function"]["arguments"] += (
                            tool_call_delta.function.arguments
                        )

            content = delta.content or ""
            reasoning_content = getattr(delta, "reasoning_content", "") or ""
            pending_content += content
            if content or reasoning_content:
                yield cls._event(
                    config,
                    event="message",
                    content=content,
                    think_message=reasoning_content,
                    **context,
                )

        yield cls._step(
            config,
            "model_call",
            "completed",
            "模型调用完成",
            node_id="model-call-1",
            node_kind="model",
            **context,
        )
        if not tool_calls:
            return

        messages.append(
            {
                "role": "assistant",
                "content": pending_content or None,
                "tool_calls": tool_calls,
            }
        )
        for tool_call in tool_calls:
            tool_name = tool_call["function"]["name"]
            try:
                tool_args = json.loads(tool_call["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                tool_args = {}
            query = tool_args.get("query", "")
            yield cls._step(
                config,
                "tool_call",
                "started",
                f"正在调用工具：{tool_name}",
                details={"tool": tool_name, "arguments": tool_args},
                **context,
            )
            if tool_name == "web_search":
                tool_result = await asyncio.to_thread(web_search, query)
            else:
                tool_result = f"不支持的工具: {tool_name}"
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "content": tool_result,
                }
            )
            yield cls._step(
                config,
                "tool_call",
                "completed",
                f"工具调用完成：{tool_name}",
                details={"tool": tool_name},
                **context,
            )

        yield cls._step(
            config, "model_call", "started", "开始工具结果后的模型调用", **context
        )
        followup_kwargs = {
            "model": config["model_name"],
            "messages": messages,
            "stream": True,
            **thinking_kwargs,
        }
        followup_stream = await client.chat.completions.create(**followup_kwargs)
        async for chunk in followup_stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            content = delta.content or ""
            reasoning_content = getattr(delta, "reasoning_content", "") or ""
            if content or reasoning_content:
                yield cls._event(
                    config,
                    event="message",
                    content=content,
                    think_message=reasoning_content,
                    **context,
                )
        yield cls._step(
            config,
            "model_call",
            "completed",
            "工具结果后的模型调用完成",
            **context,
        )

    @classmethod
    def get_agent_list(cls):
        session = None
        try:
            session = get_session("agent-knowledge")
            agents = session.query(AgentList).filter_by(status=1).order_by(AgentList.id).all()
            from models.admin_models import AdminResource, AdminVersion
            defaults = {}
            for resource in session.query(AdminResource).filter_by(kind="agents", online=1):
                release = session.query(AdminVersion).filter_by(resource_id=resource.id, version=resource.published_version).first()
                if release:
                    defaults[release.payload["agentCode"]] = {"defaultThink": release.payload.get("default_think", False),
                        "defaultKnowledge": release.payload.get("default_knowledge", False),
                        "defaultConnect": release.payload.get("default_connect", False), "configVersion": release.version}
            result = [
                {
                    "id": agent.id,
                    "agentCode": agent.agentcode,
                    "agentName": agent.agentname,
                    "agentValue": agent.model_name,
                    "slot": agent.slot or [],
                    "model_type": agent.model_type,
                    "status": agent.status,
                    "description": agent.description,
                    "default": agent.is_default,
                    "supportFile": agent.support_file,
                    "supportThink": agent.support_think,
                    "supportConnect": agent.support_connect,
                    "supportKnowledge": agent.support_knowledge,
                    "supportDownload": agent.support_download,
                    **defaults.get(agent.agentcode, {}),
                }
                for agent in agents
            ]
            return {"code": 0, "message": "success", "data": result}
        except Exception as exc:
            return {"code": -1, "message": f"获取 agent 列表失败: {exc}"}
        finally:
            if session:
                session.close()
