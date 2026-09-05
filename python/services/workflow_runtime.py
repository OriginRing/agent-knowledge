"""Adapters from the workflow interpreter to the existing model and Skill services."""
import asyncio
import copy
import inspect
import anyio
import uuid
from collections import Counter

from db.sqlalchemy_connection import get_session
from services.admin_service import skill_definition
from models.admin_models import AdminSkillLease
from services.skill_service import SkillService
from services.workflow_service import execute_graph, as_text

active_skill_versions = Counter()


async def stream_workflow(config, *, text, files=None, username=None, session_id=None,
                          thinking=None, memory=None):
    graph = copy.deepcopy(config['workflow'])
    inputs = {'text': text, 'files': (files or []) if config.get('support_file') else []}
    inputs['thinking'] = bool(config.get('support_think') and
                              (config.get('default_think', False) if thinking is None else thinking))
    fixed_skills = {}
    run_id = uuid.uuid4().hex
    with get_session('agent-knowledge') as session, session.begin():
        # Lock in stable order to prevent lock inversion for workflows sharing skills.
        keys = sorted({(n['data']['skillId'], n['data']['skillVersion']) for n in graph['nodes'] if n['type'] == 'skill'})
        for key in keys:
            fixed_skills[key] = skill_definition(session, *key, config['agent_code'])
            session.add(AdminSkillLease(run_id=run_id, skill_id=key[0], skill_version=key[1]))
    for node in graph['nodes']:
        if node['type'] == 'skill':
            key = (node['data']['skillId'], node['data']['skillVersion'])
            node['data']['skillName'] = fixed_skills[key].name
    for key in fixed_skills:
        active_skill_versions[key] += 1
    base_messages = []
    latest_presentation = ''
    async def prepare_context():
        if config.get('system_prompt'):
            base_messages.append({'role': 'system', 'content': config['system_prompt']})
        if session_id and username:
            from agent.history_manager import HistoryManager
            base_messages.extend(await asyncio.to_thread(HistoryManager.get_history_messages, username, session_id))
        if username and memory is not False:
            from services.memory_service import is_memory_enabled, search_memory, format_memory_context
            if await asyncio.to_thread(is_memory_enabled, username):
                result = await asyncio.to_thread(search_memory, username, session_id, text)
                content = format_memory_context(result)
                if content:
                    base_messages.append({'role': 'system', 'content': content})
        explicit = {s.name for s in fixed_skills.values()}
        if inputs['files'] and config.get('support_file') and 'file-reader' not in explicit:
            result = await asyncio.to_thread(SkillService.execute, 'file-reader',
                agent_code=config['agent_code'], query=text, files=inputs['files'], requester_username=username)
            base_messages.append({'role': 'system', 'content': as_text(result.get('context', result))})

    async def model_call(data):
        from agent.agent_service import AgentService
        client = AgentService.get_model(config['agent_code'], reasoning=inputs['thinking'], config=config)
        messages = list(base_messages)
        if data.get('prompt'):
            messages.append({'role': 'system', 'content': as_text(data['prompt'])})
        messages.append({'role': 'user', 'content': as_text(data.get('input', text))})
        content, reasoning = '', ''
        if config['model_type'] == 'ollama':
            async for chunk in client.astream(messages):
                content += chunk.content or ''
                reasoning += chunk.additional_kwargs.get('reasoning_content', '') or ''
        else:
            stream = await client.chat.completions.create(model=config['model_name'], messages=messages, stream=True,
                **AgentService._get_thinking_kwargs(config.get('base_url'), config['model_name'], inputs['thinking']))
            try:
                async for chunk in stream:
                    if chunk.choices:
                        delta = chunk.choices[0].delta
                        content += delta.content or ''
                        reasoning += getattr(delta, 'reasoning_content', '') or ''
            finally:
                await stream.close()
        if latest_presentation and latest_presentation not in content:
            content = (latest_presentation + '\n\n' + content).strip()
        return {'text': content, 'reasoning': reasoning}

    async def skill_call(data):
        definition = fixed_skills[(data['skillId'], data['skillVersion'])]
        if definition.name == 'file-reader' and not config.get('support_file'):
            raise ValueError('当前智能体不支持文件输入')
        if (definition.kind == 'artifact' or definition.name == 'artifact-generator') and not config.get('support_download'):
            raise ValueError('当前智能体不支持产物生成')
        SkillService.ensure_agent_allowed(definition, config['agent_code'])
        if not definition.entrypoint:
            return {'context': definition.prompt, 'data': {}}
        handler = SkillService.get_handler(definition)
        arguments = data.get('arguments', {})
        if not isinstance(arguments, dict):
            raise ValueError('Skill 参数必须是对象')
        kwargs = {'query': text, 'files': inputs['files'], 'upstream_data': {}, **arguments,
                  'agent_code': config['agent_code'], 'requester_username': username}
        if inspect.iscoroutinefunction(handler):
            result = await handler(**kwargs)
        else:
            # Keep the lease until synchronous code actually finishes, even after HTTP cancellation.
            task = asyncio.create_task(asyncio.to_thread(handler, **kwargs))
            try:
                result = await asyncio.shield(task)
            except asyncio.CancelledError:
                with anyio.CancelScope(shield=True):
                    await asyncio.shield(task)
                raise
        if not isinstance(result, dict):
            raise ValueError('Skill 返回值必须为字典')
        return result

    version_fields = {'agentVersion': config.get('config_version'), 'workflowVersion': config.get('workflowVersion'),
                      'agentCode': config['agent_code'], 'agentName': config.get('agent_name', config.get('name', '')),
                      'thinking': inputs['thinking'],
                      'skills': [s.name for s in fixed_skills.values()]}
    try:
        await prepare_context()
        async for event in execute_graph(graph, inputs, model_call, skill_call):
            node = event.get('node', {})
            if node.get('kind') == 'skill' and node.get('status') == 'success':
                output = node.get('details', {}).get('output', {})
                # Only executed upstream Skills contribute context to subsequent models.
                # Keep the original structured output available for explicit references.
                if output.get('context') and output.get('status') != 'skipped':
                    base_messages.append({'role': 'system', 'content':
                        '以下是工作流 Skill 返回的参考资料，请结合用户问题使用：\n' + as_text(output['context'])})
                if output.get('presentation') and output.get('status') != 'skipped':
                    latest_presentation = as_text(output['presentation'])
                    base_messages.append({'role': 'system', 'content':
                        '以下是上游 Skill 生成的展示内容，回答时必须原样保留：\n' + latest_presentation})
            yield {**version_fields, **event}
    except asyncio.CancelledError:
        raise
    except Exception as exc:
        yield {**version_fields, 'event': 'error', 'done': True, 'error': str(exc)}
    finally:
        with get_session('agent-knowledge') as session, session.begin():
            session.query(AdminSkillLease).filter_by(run_id=run_id).delete()
        for key in fixed_skills:
            active_skill_versions[key] -= 1
            if active_skill_versions[key] <= 0:
                del active_skill_versions[key]
