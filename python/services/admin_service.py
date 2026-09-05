"""Admin drafts and immutable releases. All mutations use row locks + revisions."""
import copy
import io
import os
import re
import shutil
import stat
import uuid
import zipfile
from pathlib import Path, PurePosixPath

from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func
from db.sqlalchemy_connection import get_session
from models.admin_models import AdminResource, AdminVersion, AdminSkillLease, AdminModel
from models.db_models import AgentList
from services.skill_service import SkillService, SkillDefinition
from services.workflow_service import validate_graph

STORAGE = Path(os.getenv('ADMIN_SKILLS_DIR', str(Path(__file__).resolve().parents[1] / 'data' / 'admin-skills')))
KINDS = {'agents', 'workflows', 'skills'}


class AgentDraft(BaseModel):
    model_config = ConfigDict(extra='allow')
    name: str = Field(min_length=1, max_length=100)
    modelId: str = Field(min_length=1, max_length=64)
    system_prompt: str = ''
    description: str | None = ''
    slot: list = Field(default_factory=list)
    support_file: bool = False
    support_download: bool = False
    support_think: bool = False
    support_connect: bool = False
    support_knowledge: bool = False
    default_think: bool = False
    default_connect: bool = False
    default_knowledge: bool = False


def fail(message, status=400):
    raise HTTPException(status_code=status, detail=message)


def record(row):
    return {'id': row.id, 'kind': row.kind, 'name': row.name, 'revision': row.revision,
            'draft': row.draft, 'publishedVersion': row.published_version, 'online': bool(row.online)}


def get_row(session, kind, key, lock=False):
    query = session.query(AdminResource).filter_by(id=key, kind=kind)
    row = (query.with_for_update() if lock else query).first()
    if not row or row.draft.get('_deleted'):
        fail('记录不存在', 404)
    return row


def revision_check(row, revision):
    if row.revision != revision:
        fail('内容已被其他操作修改，请刷新后重试', 409)


def version_payload(session, key, version):
    row = session.query(AdminVersion).filter_by(resource_id=key, version=version).first()
    if not row:
        fail('引用的发布版本不存在', 400)
    return copy.deepcopy(row.payload)


def add_version(session, row, payload):
    # One current publication; revision remains an internal concurrency/cache token.
    session.query(AdminVersion).filter_by(resource_id=row.id).delete()
    number = row.revision
    session.add(AdminVersion(resource_id=row.id, version=number, payload=copy.deepcopy(payload)))
    row.published_version = number
    return number


def latest_graph(session, payload):
    graph = copy.deepcopy(payload)
    for node in graph.get('nodes', []):
        if node.get('type') == 'skill':
            data = node.setdefault('data', {})
            skill = get_row(session, 'skills', data.get('skillId'), True)
            if not skill.published_version:
                fail('Skill 已被删除')
            data['skillVersion'] = skill.published_version
    return graph


def invalidate_agents(session, workflow_ids):
    for agent in session.query(AdminResource).filter_by(kind='agents'):
        if agent.draft.get('_deleted'):
            continue
        published = session.query(AdminVersion).filter_by(resource_id=agent.id).first()
        if agent.draft.get('workflowId') in workflow_ids or (published and published.payload.get('workflowId') in workflow_ids):
            agent.draft = {**agent.draft, 'needsPublish': True}
            agent.online = 0
            agent.revision += 1
            projection = session.query(AgentList).filter_by(agentcode=agent.draft['agentCode']).first()
            if projection:
                projection.status = 0


def workflow_usage(session):
    # Count each existing agent once across its draft and immutable releases.
    usage = {}
    agents = {r.id: r for r in session.query(AdminResource).filter_by(kind='agents')
              if not r.draft.get('_deleted')}
    payloads = [(r.id, r.draft) for r in agents.values()]
    payloads.extend((v.resource_id, v.payload) for v in session.query(AdminVersion)
                    if v.resource_id in agents)
    for key, payload in payloads:
        if payload.get('workflowId'):
            usage.setdefault(payload['workflowId'], set()).add(key)
    return usage


def model_record(row):
    return {'id': row.id, 'name': row.name, 'modelType': row.model_type,
            'modelName': row.model_name, 'baseUrl': row.base_url or '',
            'apiKeyName': row.api_key_name or '', 'revision': row.revision}


def list_models():
    with get_session('agent-knowledge') as session:
        return [model_record(row) for row in session.query(AdminModel).order_by(AdminModel.name)]


def model_agent_ids(session, key):
    result = set()
    agents = {row.id: row for row in session.query(AdminResource).filter_by(kind='agents')
              if not row.draft.get('_deleted')}
    for agent_id, agent in agents.items():
        if agent.draft.get('modelId') == key:
            result.add(agent_id)
    for release in session.query(AdminVersion):
        if release.resource_id in agents and release.payload.get('modelId') == key:
            result.add(release.resource_id)
    return result


def save_model(payload, key=None, revision=None):
    name, model_type, model_name = (str(payload.get(x, '')).strip()
                                    for x in ('name', 'modelType', 'modelName'))
    if not name or not model_name or model_type not in {'ollama', 'api'}:
        fail('请填写模型配置名称、模型类型和模型名称')
    base_url = str(payload.get('baseUrl', '')).strip()
    api_key_name = str(payload.get('apiKeyName', '')).strip()
    from urllib.parse import urlparse
    address = base_url or ('http://127.0.0.1:11434' if model_type == 'ollama' else '')
    parsed = urlparse(address)
    if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password:
        fail('模型地址必须是有效 HTTP(S) 地址，不能包含凭据')
    if model_type == 'api' and not re.fullmatch(r'[A-Z_][A-Z0-9_]*', api_key_name):
        fail('云端模型必须填写有效的密钥环境变量名')
    with get_session('agent-knowledge') as session, session.begin():
        if key:
            row = session.query(AdminModel).filter_by(id=key).with_for_update().first()
            if not row: fail('模型配置不存在', 404)
            if row.revision != revision: fail('内容已被其他操作修改，请刷新后重试', 409)
            row.revision += 1
        else:
            row = AdminModel(id='model-' + uuid.uuid4().hex, revision=1)
            session.add(row)
        row.name, row.model_type, row.model_name = name, model_type, model_name
        row.base_url, row.api_key_name = base_url or None, api_key_name or None
        affected = model_agent_ids(session, key) if key else set()
        for agent in session.query(AdminResource).filter_by(kind='agents'):
            if agent.id in affected:
                agent.draft = {**agent.draft, 'needsPublish': True}
                agent.online = 0
                agent.revision += 1
                projected = session.query(AgentList).filter_by(agentcode=agent.draft['agentCode']).first()
                if projected: projected.status = 0
        session.flush()
        return model_record(row)


def delete_model(key, revision):
    with get_session('agent-knowledge') as session, session.begin():
        row = session.query(AdminModel).filter_by(id=key).with_for_update().first()
        if not row: fail('模型配置不存在', 404)
        if row.revision != revision: fail('内容已被其他操作修改，请刷新后重试', 409)
        count = len(model_agent_ids(session, key))
        if count: fail(f'模型正被 {count} 个智能体使用，不能删除', 409)
        session.delete(row)
        return {'deleted': True}


def delete_resource(kind, key, revision):
    if kind not in {'agents', 'workflows'}:
        fail('不支持删除此资源', 404)
    with get_session('agent-knowledge') as session, session.begin():
        row = get_row(session, kind, key, True)
        revision_check(row, revision)
        if kind == 'agents' and row.online:
            fail('请先下线智能体再删除', 409)
        if kind == 'workflows':
            count = len(workflow_usage(session).get(key, set()))
            if count:
                fail(f'工作流正被 {count} 个智能体使用，不能删除', 409)
        # Tombstones retain history/version identity and prevent bootstrap resurrection.
        row.draft = {**row.draft, '_deleted': True}
        row.online = 0
        row.revision += 1
        if kind == 'agents':
            agent = session.query(AgentList).filter_by(agentcode=row.draft['agentCode']).first()
            if agent:
                agent.status = 0
        return {'deleted': True}


def list_resources(kind):
    if kind not in KINDS:
        fail('不支持的资源', 404)
    with get_session('agent-knowledge') as session:
        query = session.query(AdminResource).filter_by(kind=kind)
        if kind == 'skills':
            query = query.filter(AdminResource.published_version.isnot(None))
        rows = [row for row in query.order_by(AdminResource.name) if not row.draft.get('_deleted')]
        usage = workflow_usage(session) if kind == 'workflows' else {}
        return [{**record(row), **({'agentCount': len(usage.get(row.id, set()))} if kind == 'workflows' else {})} for row in rows]


def detail(kind, key):
    with get_session('agent-knowledge') as session:
        row = get_row(session, kind, key)
        result = record(row)
        if kind == 'workflows':
            result['agentCount'] = len(workflow_usage(session).get(key, set()))
        # No historical publication list is exposed.
        return result


def save(kind, payload, key=None, revision=None):
    if kind not in {'agents', 'workflows'}:
        fail('该资源不支持表单保存')
    name = str(payload.get('name', '')).strip()
    if not name or len(name) > 100:
        fail('名称必填且不能超过 100 个字符')
    payload = copy.deepcopy(payload)
    payload.pop('_deleted', None)
    payload.pop('needsPublish', None)
    if kind == 'agents':
        for field in ('model_type', 'model_name', 'base_url', 'api_key_name', 'modelRevision',
                      'workflowVersion', 'legacy'):
            payload.pop(field, None)
    payload['name'] = name
    if kind == 'workflows':
        for index, node in enumerate(payload.get('nodes') or []):
            if isinstance(node, dict):
                node.setdefault('position', {'x': 70 + index * 260, 'y': 160})
                node.setdefault('data', {})
    with get_session('agent-knowledge') as session, session.begin():
        if key:
            row = get_row(session, kind, key, True)
            revision_check(row, revision)
            row.revision += 1
            if row.draft.get('needsPublish'):
                payload['needsPublish'] = True
        else:
            row = AdminResource(id=uuid.uuid4().hex, kind=kind, revision=1, online=0)
        if kind == 'agents':
            payload = dict(payload)
            if payload.get('workflowId'):
                get_row(session, 'workflows', payload['workflowId'], True)
            # Codes are stable once allocated, including legacy five-digit identifiers.
            if key:
                payload['agentCode'] = row.draft['agentCode']
            else:
                codes = {r.draft.get('agentCode') for r in session.query(AdminResource).filter_by(kind='agents')}
                codes.update(x.agentcode for x in session.query(AgentList))
                payload['agentCode'] = next((str(i) for i in range(400000, 1000000) if str(i) not in codes), None)
                if payload['agentCode'] is None:
                    fail('智能体编号已用尽')
                row.id = 'agent-' + payload['agentCode']
        row.name, row.draft = name, payload
        session.add(row)
        if kind == 'workflows':
            row.online = 1
            add_version(session, row, payload)
            invalidate_agents(session, {row.id})
        session.flush()
        return record(row)


def resolve_agent_model(payload, session, lock=False):
    """Expand the model selected by an agent draft into runtime configuration."""
    payload.update(AgentDraft.model_validate(payload).model_dump())
    query = session.query(AdminModel).filter_by(id=payload['modelId'])
    model = (query.with_for_update() if lock else query).first()
    if not model:
        fail('请选择有效模型')
    payload.update(model_type=model.model_type, model_name=model.model_name,
                   base_url=model.base_url or '', api_key_name=model.api_key_name or '',
                   modelRevision=model.revision)
    if payload['model_type'] == 'api':
        key = payload.get('api_key_name') or ''
        if not re.fullmatch(r'[A-Z_][A-Z0-9_]*', key) or not os.getenv(key):
            fail('密钥环境变量无效或尚未在服务端配置')
    return payload


def validate_agent(payload, session):
    resolve_agent_model(payload, session, lock=True)
    for capability in ('think', 'connect', 'knowledge'):
        if payload.get(f'default_{capability}') and not payload.get(f'support_{capability}'):
            fail('默认开启的能力必须同时启用支持开关')
    slots = payload.get('slot', [])
    if not isinstance(slots, list) or any(not isinstance(s, dict) or not isinstance(s.get('title'), str) or not isinstance(s.get('content'), str) for s in slots):
        fail('词槽必须为包含 title、content 的数组')
    workflow = payload.get('workflowId')
    if not workflow:
        fail('请选择工作流')
    resource = get_row(session, 'workflows', workflow, True)
    payload['workflowVersion'] = resource.revision
    graph = latest_graph(session, resource.draft)
    validate_graph(graph, lambda i, v, a: skill_definition(session, i, v, a), payload['agentCode'])
    return graph


def publish(kind, key, revision):
    with get_session('agent-knowledge') as session, session.begin():
        row = get_row(session, kind, key, True)
        revision_check(row, revision)
        payload = copy.deepcopy(row.draft)
        payload.pop('needsPublish', None)
        if kind == 'workflows':
            payload = latest_graph(session, payload)
            validate_graph(payload, lambda i, v, a: skill_definition(session, i, v, a))
        elif kind == 'agents':
            payload['workflow'] = validate_agent(payload, session)
            payload.pop('legacy', None)
        else:
            fail('不支持此发布操作')
        add_version(session, row, payload)
        row.online = 1
        row.draft = {k: v for k, v in row.draft.items() if k != 'needsPublish'}
        row.revision += 1
        if kind == 'agents':
            project_agent(session, payload, True)
        session.flush()
        return record(row)


def offline(key, revision):
    with get_session('agent-knowledge') as session, session.begin():
        row = get_row(session, 'agents', key, True)
        revision_check(row, revision)
        row.online = 0
        row.revision += 1
        agent = session.query(AgentList).filter_by(agentcode=row.draft['agentCode']).first()
        if agent:
            agent.status = 0
        return record(row)


def project_agent(session, payload, online):
    row = session.query(AgentList).filter_by(agentcode=payload['agentCode']).first()
    if not row:
        row = AgentList(agentcode=payload['agentCode'])
        session.add(row)
    row.agentname = payload['name']
    row.model_id = payload['modelId']
    for field in ('description', 'slot',
                  'support_file', 'support_think', 'support_connect', 'support_knowledge', 'support_download'):
        if field in payload:
            setattr(row, field, payload[field])
    row.status = int(online)
    if payload.get('is_default'):
        session.query(AgentList).filter(AgentList.agentcode != row.agentcode).update({'is_default': False})
    row.is_default = bool(payload.get('is_default'))


def published_config(agent_code):
    with get_session('agent-knowledge') as session:
        # JSON predicates differ across SQLite tests and MySQL; resources are a small control-plane set.
        row = next((r for r in session.query(AdminResource).filter_by(kind='agents')
                    if r.draft.get('agentCode') == agent_code), None)
        if not row:
            return None
        if row.draft.get('_deleted') or not row.online or not row.published_version:
            return {'disabled': True}
        payload = version_payload(session, row.id, row.published_version)
        return {**payload, 'agent_code': agent_code, 'agent_name': payload['name'],
                'config_version': row.published_version, 'resource_id': row.id}


def skill_definition(session, key, version, agent_code=None):
    get_row(session, 'skills', key, True)
    data = version_payload(session, key, version)
    definition = SkillDefinition(name=data['name'], description=data.get('description', ''), prompt=data.get('prompt', ''),
        path=Path(data['path']), entrypoint=data.get('entrypoint'), kind=data.get('kind', 'prompt'),
        agent_codes=data.get('agent_codes', []), file_extensions=data.get('file_extensions', []),
        intent_keywords=data.get('intent_keywords', []), artifact=data.get('artifact'), order=data.get('order', 100))
    if agent_code:
        SkillService.ensure_agent_allowed(definition, agent_code)
    if not definition.path.is_file():
        fail('Skill 版本文件已丢失')
    return definition


def skill_metadata(folder):
    file = folder / 'SKILL.md'
    metadata, prompt = SkillService._parse_frontmatter(file.read_text(encoding='utf-8'))
    name = metadata.get('name', '')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}', name):
        fail('SKILL.md 必须声明有效 name')
    kind = metadata.get('kind', 'prompt')
    entrypoint = metadata.get('entrypoint') or None
    if kind not in {'prompt', 'executor', 'hybrid', 'artifact'}:
        fail('Skill kind 无效')
    if kind in {'executor', 'hybrid', 'artifact'} and not entrypoint:
        fail('执行型 Skill 必须声明 entrypoint')
    if entrypoint:
        parts = entrypoint.split(':')
        if len(parts) != 2 or not parts[1].isidentifier():
            fail('entrypoint 格式应为 handler.py:execute')
        path = (folder / parts[0]).resolve()
        if not path.is_relative_to(folder.resolve()) or not path.is_file() or path.suffix != '.py':
            fail('Skill 入口必须是包内 Python 文件')
    return {'name': name, 'description': metadata.get('description', ''), 'kind': kind,
            'entrypoint': entrypoint, 'prompt': prompt, 'path': str(file),
            'agent_codes': SkillService._csv(metadata.get('agent_codes', '')),
            'file_extensions': SkillService._csv(metadata.get('file_extensions', '')),
            'intent_keywords': SkillService._csv(metadata.get('intent_keywords', '')),
            'artifact': metadata.get('artifact'), 'order': int(metadata.get('order', '100')),
            'dependencies': (folder / 'requirements.txt').read_text(encoding='utf-8') if (folder / 'requirements.txt').is_file() else '',
            'dependencyStatus': '未自动安装或导入验证'}


def upload_skill(raw):
    if len(raw) > 20 * 1024 * 1024:
        fail('压缩包不能超过 20 MB', 413)
    folder = STORAGE / uuid.uuid4().hex
    folder.mkdir(parents=True)
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            infos = archive.infolist()
            if len(infos) > 500 or sum(i.file_size for i in infos) > 50 * 1024 * 1024:
                fail('压缩包最多 500 个条目，解压总大小不能超过 50 MB')
            seen = set()
            for info in infos:
                path = PurePosixPath(info.filename)
                mode = info.external_attr >> 16
                if (path.is_absolute() or '..' in path.parts or '\\' in info.filename or ':' in info.filename
                        or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in {0, stat.S_IFREG, stat.S_IFDIR})
                        or str(path).lower() in seen or info.flag_bits & 1):
                    fail('压缩包包含非法路径、重复文件、链接或加密条目')
                seen.add(str(path).lower())
            archive.extractall(folder)
        candidates = list(folder.glob('SKILL.md')) or list(folder.glob('*/SKILL.md'))
        if len(candidates) != 1:
            fail('压缩包根目录或唯一一级目录必须包含 SKILL.md')
        payload = skill_metadata(candidates[0].parent)
        payload['builtin'] = False
        with get_session('agent-knowledge') as session, session.begin():
            row = session.query(AdminResource).filter_by(kind='skills', name=payload['name']).with_for_update().first()
            if row and row.draft.get('builtin'):
                fail('不能覆盖内置 Skill')
            if not row:
                row = AdminResource(id='skill-' + payload['name'], kind='skills', name=payload['name'], revision=0, online=1, draft=payload)
                session.add(row)
                session.flush()
            row.draft = payload
            row.online = 1
            row.revision += 1
            add_version(session, row, payload)
            flows = {w.id for w in session.query(AdminResource).filter_by(kind='workflows')
                     if any(n.get('data', {}).get('skillId') == row.id for n in w.draft.get('nodes', []))}
            for release in session.query(AdminVersion):
                if any(n.get('data', {}).get('skillId') == row.id for n in release.payload.get('workflow', {}).get('nodes', [])):
                    flows.add(release.payload.get('workflowId'))
            invalidate_agents(session, flows)
            session.flush()
            return record(row)
    except Exception:
        shutil.rmtree(folder, ignore_errors=True)
        raise


def references(session, key, version):
    result = []
    def uses(payload):
        graph = payload.get('workflow', payload)
        return any(n.get('type') == 'skill' and n.get('data', {}).get('skillId') == key
                   for n in graph.get('nodes', []))
    for row in session.query(AdminResource).filter(AdminResource.kind.in_(['agents', 'workflows'])):
        if uses(row.draft):
            result.append(f'{row.name} / 草稿')
        for release in session.query(AdminVersion).filter_by(resource_id=row.id):
            if uses(release.payload):
                result.append(f'{row.name} / v{release.version}')
    return result


def skill_references(key, version):
    with get_session('agent-knowledge') as session:
        return references(session, key, version)


def delete_skill(key, version):
    from services.workflow_runtime import active_skill_versions
    with get_session('agent-knowledge') as session, session.begin():
        row = get_row(session, 'skills', key, True)
        data = version_payload(session, key, version)
        if data.get('builtin'):
            fail('内置 Skill 不允许删除')
        refs = references(session, key, version)
        if session.query(AdminSkillLease).filter_by(skill_id=key, skill_version=version).first():
            refs.append('运行中的请求')
        if refs or (key, version) in active_skill_versions:
            fail('Skill 正被引用，不能删除：' + '、'.join(refs or ['运行中的调试请求']), 409)
        session.query(AdminVersion).filter_by(resource_id=key, version=version).delete()
        session.flush()
        latest = session.query(AdminVersion).filter_by(resource_id=key).order_by(AdminVersion.version.desc()).first()
        if latest:
            row.published_version, row.draft = latest.version, latest.payload
            row.revision += 1
        else:
            # Keep the revision sequence so re-uploading the same name never reuses an issued version.
            row.published_version = None
            row.online = 0
            row.revision += 1
    # Version payloads can never be re-used. Only delete their dedicated storage directory.
    path = Path(data['path']).resolve()
    if path.is_relative_to(STORAGE.resolve()):
        shutil.rmtree(STORAGE / path.relative_to(STORAGE.resolve()).parts[0])
    return {'deleted': True}


def bootstrap():
    """Idempotent import; never rewrites an existing draft or release."""
    with get_session('agent-knowledge') as session, session.begin():
        removed_image_skill = session.get(AdminResource, 'skill-image-to-document')
        if removed_image_skill and removed_image_skill.draft.get('builtin'):
            session.query(AdminSkillLease).filter_by(skill_id=removed_image_skill.id).delete()
            session.query(AdminVersion).filter_by(resource_id=removed_image_skill.id).delete()
            session.delete(removed_image_skill)
        marker = session.get(AdminResource, 'migration-models-v1')
        if not marker:
            candidates = []
            for agent in session.query(AgentList):
                candidates.append((agent.agentname, agent.model_type, agent.model_name,
                                   agent.base_url, agent.api_key_name))
                agent.status = 0
            for agent in session.query(AdminResource).filter_by(kind='agents'):
                data = agent.draft
                if data.get('model_type') and data.get('model_name'):
                    candidates.append((data.get('model_name'), data['model_type'], data['model_name'],
                                       data.get('base_url'), data.get('api_key_name')))
                agent.draft = {**data, '_deleted': True}
                agent.online = 0
                agent.revision += 1
            seen = set()
            for name, model_type, model_name, base_url, api_key_name in candidates:
                signature = (model_type, model_name, base_url or '', api_key_name or '')
                if signature in seen: continue
                seen.add(signature)
                session.add(AdminModel(id='model-' + uuid.uuid5(uuid.NAMESPACE_URL, repr(signature)).hex,
                    name=name or model_name, model_type=model_type, model_name=model_name,
                    base_url=base_url, api_key_name=api_key_name, revision=1))
            session.query(AgentList).update({'model_type': None, 'model_name': None,
                                             'base_url': None, 'api_key_name': None})
            session.add(AdminResource(id='migration-models-v1', kind='state', name='model migration',
                                      revision=1, online=0, draft={'done': True}))
        if session.query(AdminModel).count():
            session.query(AgentList).update({'model_type': None, 'model_name': None,
                                             'base_url': None, 'api_key_name': None})
        for skill in SkillService.load_skills(refresh=True).values():
            key = 'skill-' + skill.name
            if session.get(AdminResource, key):
                continue
            folder = STORAGE / ('builtin-' + skill.name)
            if not folder.exists():
                shutil.copytree(skill.path.parent, folder, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
            payload = skill_metadata(folder)
            payload['builtin'] = True
            session.add(AdminResource(id=key, kind='skills', name=skill.name, revision=1, draft=payload,
                                      online=1, published_version=1))
            session.add(AdminVersion(resource_id=key, version=1, payload=payload))

        session.flush()
        # Migrate the installed built-in metadata as well as the source package.
        sales = session.get(AdminResource, 'skill-sales-performance')
        if sales and sales.draft.get('builtin') and sales.draft.get('agent_codes'):
            sales.draft = {**sales.draft, 'agent_codes': []}
            sales.revision += 1
            add_version(session, sales, sales.draft)
            skill_file = Path(sales.draft['path'])
            if skill_file.is_file() and skill_file.resolve().is_relative_to(STORAGE.resolve()):
                content = skill_file.read_text(encoding='utf-8')
                skill_file.write_text(re.sub(r'^agent_codes:.*\n', '', content, flags=re.MULTILINE), encoding='utf-8')
        session.flush()
        # Reconcile old pinned publications before discarding legacy history.
        stale_flows = set()
        for agent in session.query(AdminResource).filter_by(kind='agents'):
            if agent.draft.get('_deleted') or agent.draft.get('needsPublish'):
                continue
            release = session.query(AdminVersion).filter_by(resource_id=agent.id, version=agent.published_version).first()
            if release and release.payload.get('workflowId'):
                key = release.payload['workflowId']
                try:
                    current = latest_graph(session, get_row(session, 'workflows', key).draft)
                    if current != release.payload.get('workflow'):
                        stale_flows.add(key)
                except HTTPException:
                    stale_flows.add(key)
        invalidate_agents(session, stale_flows)
        session.flush()
        for resource in session.query(AdminResource):
            if resource.published_version:
                session.query(AdminVersion).filter(AdminVersion.resource_id == resource.id,
                    AdminVersion.version != resource.published_version).delete()
        # agent_list is only a user-list projection of a workflow-backed admin agent.
        valid_codes = set()
        for resource in session.query(AdminResource).filter_by(kind='agents'):
            if resource.draft.get('_deleted') or not resource.published_version:
                continue
            release = session.query(AdminVersion).filter_by(
                resource_id=resource.id, version=resource.published_version).first()
            if release and release.payload.get('workflow') and release.payload.get('workflowId'):
                valid_codes.add(release.payload.get('agentCode'))
        session.query(AgentList).filter(~AgentList.agentcode.in_(valid_codes)).delete(
            synchronize_session=False)
