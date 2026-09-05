import asyncio
import copy
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException, FastAPI
from fastapi.testclient import TestClient
from models.admin_models import AdminResource, AdminVersion, AdminDebugRun, AdminSkillLease, AdminModel
from models.db_models import AgentList, User
from services import admin_service as admin
from services.workflow_service import validate_graph, execute_graph, resolve


def graph():
    return {'name': '测试流程', 'nodes': [
        {'id': 'start', 'type': 'start', 'data': {}},
        {'id': 'model', 'type': 'model', 'data': {'input': '{{input.text}}'}},
        {'id': 'end', 'type': 'end', 'data': {'answer': '{{nodes.model.output.text}}', 'artifacts': []}},
    ], 'edges': [{'source': 'start', 'target': 'model'}, {'source': 'model', 'target': 'end'}]}


def archive(name='test-skill', extra=None):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w') as zipped:
        zipped.writestr('SKILL.md', f'---\nname: {name}\nkind: prompt\n---\n测试提示词')
        for key, value in (extra or {}).items():
            zipped.writestr(key, value)
    return buffer.getvalue()


class WorkflowTest(unittest.IsolatedAsyncioTestCase):
    async def test_events_use_readable_node_titles_instead_of_canvas_ids(self):
        async def model(data): return {'text': '回答'}
        events = [event async for event in execute_graph(graph(), {'text': '测试'}, model, None)]
        nodes = [event['node'] for event in events if event.get('event') == 'node'
                 and event['node']['status'] == 'running']
        self.assertEqual([node['title'] for node in nodes], ['开始', '模型', '结束'])
        self.assertEqual([node['name'] for node in nodes], ['start', 'model', 'end'])

    async def test_model_skill_model_structured_handoff(self):
        flow = graph()
        flow['nodes'].insert(2, {'id': 'skill', 'type': 'skill', 'data': {'arguments': {'upstream_data': '{{nodes.model.output}}'}}})
        flow['nodes'].insert(3, {'id': 'second', 'type': 'model', 'data': {'input': '{{nodes.skill.output.data.total}}'}})
        flow['nodes'][-1]['data']['answer'] = '{{nodes.second.output.text}}'
        flow['edges'] = [{'source': a, 'target': b} for a, b in [('start', 'model'), ('model', 'skill'), ('skill', 'second'), ('second', 'end')]]
        async def model(data): return {'text': str(data['input'])}
        async def skill(data):
            self.assertEqual(data['arguments']['upstream_data'], {'text': '问题'})
            return {'data': {'total': 42}}
        events = [event async for event in execute_graph(flow, {'text': '问题'}, model, skill)]
        self.assertEqual([e['content'] for e in events if 'content' in e], ['42'])
        self.assertEqual(len([e for e in events if e.get('node', {}).get('status') == 'success']), 5)

    async def test_skill_defaults_to_previous_skill_structured_data(self):
        flow = {'nodes': [
            {'id': 'start', 'type': 'start', 'data': {}},
            {'id': 'sales', 'type': 'skill', 'data': {'arguments': {'query': '{{input.text}}'}}},
            {'id': 'chart', 'type': 'skill', 'data': {'arguments': {'query': '{{input.text}}'}}},
            {'id': 'end', 'type': 'end', 'data': {'answer': '{{nodes.chart.output.presentation}}'}},
        ], 'edges': [{'source': a, 'target': b} for a, b in
                     [('start', 'sales'), ('sales', 'chart'), ('chart', 'end')]]}
        sales_data = {'monthly': [{'month': '2026-01', 'value': '10'}]}
        presentation = '| 月份 | 营业额 |'

        async def skill(data):
            upstream = data.get('arguments', {}).get('upstream_data')
            if upstream.get('monthly') == sales_data['monthly']:
                self.assertEqual(upstream['presentation'], presentation)
                self.assertEqual(upstream['data'], sales_data)
                return {'presentation': '图表成功'}
            self.assertEqual(data['arguments']['upstream_data'], {})
            return {'status': 'success', 'data': sales_data, 'presentation': presentation}

        events = [event async for event in execute_graph(flow, {'text': '生成图表'}, None, skill)]
        self.assertEqual(events[-1]['content'], '图表成功')

    async def test_branches(self):
        flow = {'nodes': [{'id': 'start', 'type': 'start'}, {'id': 'condition', 'type': 'condition', 'data': {'left': '{{input.text}}', 'operator': 'contains', 'right': '是'}}, {'id': 'yes', 'type': 'end', 'data': {'answer': 'yes'}}, {'id': 'no', 'type': 'end', 'data': {'answer': 'no'}}],
                'edges': [{'source': 'start', 'target': 'condition'}, {'source': 'condition', 'target': 'yes', 'sourceHandle': 'true'}, {'source': 'condition', 'target': 'no', 'sourceHandle': 'false'}]}
        for text, expected in [('是的', 'yes'), ('不是这个字以外的输入'.replace('是', ''), 'no')]:
            events = [e async for e in execute_graph(flow, {'text': text}, None, None)]
            self.assertEqual(events[-1]['content'], expected)

    async def test_error_and_cancel_stop_following_nodes(self):
        async def bad(_): raise ValueError('model failed')
        events = [e async for e in execute_graph(graph(), {'text': 'x'}, bad, None)]
        self.assertEqual(events[-1]['error'], 'model failed')
        self.assertNotIn('end', [e['node']['id'] for e in events if 'node' in e])
        async def cancelled(_): raise asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            _ = [e async for e in execute_graph(graph(), {'text': 'x'}, cancelled, None)]

    def test_invalid_graphs_and_branch_reference(self):
        flow = graph()
        flow['edges'].append({'source': 'end', 'target': 'start'})
        with self.assertRaises(ValueError): validate_graph(flow)
        flow = graph(); flow['nodes'][1]['data']['input'] = '{{nodes.end.output}}'
        with self.assertRaises(ValueError): validate_graph(flow)
        flow = graph(); flow['nodes'][1]['data']['input'] = '{{input.secret}}'
        with self.assertRaises(ValueError): validate_graph(flow)
        flow = graph(); flow['nodes'].append({'id': 'unreachable', 'type': 'end'})
        with self.assertRaises(ValueError): validate_graph(flow)
        self.assertEqual(resolve('{{input.files}}', {'input': {'files': ['a']}}), ['a'])


class AdminStorageTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.engine = create_engine('sqlite:///' + self.temp.name + '/test.db')
        for table in (AdminResource.__table__, AdminVersion.__table__, AdminDebugRun.__table__, AdminSkillLease.__table__, AdminModel.__table__, AgentList.__table__, User.__table__):
            table.create(self.engine)
        self.factory = sessionmaker(bind=self.engine)
        self.patches = [patch.object(admin, 'get_session', lambda _: self.factory()), patch.object(admin, 'STORAGE', Path(self.temp.name) / 'skills')]
        for item in self.patches: item.start()
        self.model = admin.save_model({'name': '测试模型', 'modelType': 'ollama', 'modelName': 'test', 'baseUrl': ''})

    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.engine.dispose(); self.temp.cleanup()

    def test_publish_draft_isolation_offline_and_conflict(self):
        flow = admin.save('workflows', graph())
        flow = admin.publish('workflows', flow['id'], flow['revision'])
        payload = {'name': '测试智能体', 'modelId': self.model['id'], 'slot': [],
                   'workflowId': flow['id'], 'workflowVersion': flow['publishedVersion'],
                   'support_think': True, 'default_think': True,
                   'support_connect': True, 'default_knowledge': True}
        agent = admin.save('agents', payload)
        self.assertNotIn('support_connect', agent['draft'])
        self.assertNotIn('default_knowledge', agent['draft'])
        agent = admin.publish('agents', agent['id'], agent['revision'])
        code = agent['draft']['agentCode']
        first = admin.published_config(code)
        self.assertNotIn('support_connect', first)
        self.assertNotIn('default_knowledge', first)
        changed = {**agent['draft'], 'description': 'next'}
        updated = admin.save('agents', changed, agent['id'], agent['revision'])
        self.assertEqual(admin.published_config(code)['model_name'], 'test')
        with self.assertRaises(HTTPException) as error:
            admin.publish('agents', agent['id'], agent['revision'])
        self.assertEqual(error.exception.status_code, 409)
        released = admin.publish('agents', agent['id'], updated['revision'])
        self.assertEqual(admin.published_config(code)['description'], 'next')
        self.assertEqual(first['model_name'], 'test')
        self.assertNotEqual(admin.published_config(code)['config_version'], first['config_version'])
        admin.offline(agent['id'], released['revision'])
        self.assertTrue(admin.published_config(code)['disabled'])

    def test_agent_workflow_deletion_rules_and_usage(self):
        flow = admin.save('workflows', graph())
        flow = admin.publish('workflows', flow['id'], flow['revision'])
        agent = admin.save('agents', {'name': '引用测试', 'modelId': self.model['id'],
                           'workflowId': flow['id'], 'workflowVersion': flow['publishedVersion']})
        self.assertEqual(admin.list_resources('workflows')[0]['agentCount'], 1)
        agent = admin.publish('agents', agent['id'], agent['revision'])
        self.assertEqual(admin.detail('workflows', flow['id'])['agentCount'], 1)
        with self.assertRaises(HTTPException): admin.delete_resource('agents', agent['id'], agent['revision'])
        with self.assertRaises(HTTPException): admin.delete_resource('workflows', flow['id'], flow['revision'])
        agent = admin.offline(agent['id'], agent['revision'])
        self.assertEqual(admin.detail('workflows', flow['id'])['agentCount'], 1)
        with self.assertRaises(HTTPException): admin.delete_resource('agents', agent['id'], agent['revision'] - 1)
        admin.delete_resource('agents', agent['id'], agent['revision'])
        self.assertEqual(admin.list_resources('agents'), [])
        self.assertTrue(admin.published_config(agent['draft']['agentCode'])['disabled'])
        self.assertEqual(admin.detail('workflows', flow['id'])['agentCount'], 0)
        admin.delete_resource('workflows', flow['id'], flow['revision'])
        self.assertEqual(admin.list_resources('workflows'), [])
        with self.assertRaises(HTTPException): admin.detail('workflows', flow['id'])
        with self.assertRaises(HTTPException): admin.save('agents', agent['draft'])
        with self.factory() as session:
            self.assertIsNotNone(session.get(AdminResource, agent['id']))
            self.assertGreater(session.query(AdminVersion).count(), 0)

    def test_model_is_shared_and_edit_requires_agent_republish(self):
        flow = admin.save('workflows', graph())
        agent = admin.save('agents', {'name': '模型引用', 'modelId': self.model['id'],
                                     'workflowId': flow['id']})
        agent = admin.publish('agents', agent['id'], agent['revision'])
        self.assertEqual(admin.published_config(agent['draft']['agentCode'])['model_name'], 'test')
        updated = admin.save_model({'name': '测试模型', 'modelType': 'ollama',
                                    'modelName': 'next', 'baseUrl': ''},
                                   self.model['id'], self.model['revision'])
        pending = admin.detail('agents', agent['id'])
        self.assertTrue(pending['draft']['needsPublish'])
        self.assertTrue(admin.published_config(agent['draft']['agentCode'])['disabled'])
        with self.assertRaises(HTTPException):
            admin.delete_model(updated['id'], updated['revision'])
        republished = admin.publish('agents', agent['id'], pending['revision'])
        self.assertEqual(admin.published_config(republished['draft']['agentCode'])['model_name'], 'next')

    def test_legacy_agent_list_row_has_no_execution_fallback(self):
        from agent.agent_service import AgentService
        with self.factory.begin() as session:
            session.add(AgentList(agentcode='123456', agentname='旧智能体', status=1))
        self.assertIsNone(AgentService.get_agent_config('123456'))

    def test_latest_skill_and_workflow_require_agent_republish(self):
        skill = admin.upload_skill(archive())
        flow = graph()
        flow['nodes'][1] = {'id': 'model', 'type': 'skill', 'data': {'skillId': skill['id']}}
        flow['nodes'][-1]['data']['answer'] = '{{nodes.model.output.context}}'
        workflow = admin.save('workflows', flow)
        agent = admin.save('agents', {'name': 'latest', 'modelId': self.model['id'], 'workflowId': workflow['id']})
        agent = admin.publish('agents', agent['id'], agent['revision'])
        again = admin.upload_skill(archive())
        self.assertTrue(admin.published_config(agent['draft']['agentCode'])['disabled'])
        pending = admin.detail('agents', agent['id'])
        self.assertTrue(pending['draft']['needsPublish'])
        agent = admin.publish('agents', agent['id'], pending['revision'])
        config = admin.published_config(agent['draft']['agentCode'])
        self.assertEqual(config['workflow']['nodes'][1]['data']['skillVersion'], again['publishedVersion'])
        workflow = admin.save('workflows', {**flow, 'name': 'changed'}, workflow['id'], workflow['revision'])
        self.assertTrue(admin.detail('agents', agent['id'])['draft']['needsPublish'])
        with self.factory() as session:
            for key in (workflow['id'], agent['id'], skill['id']):
                self.assertEqual(session.query(AdminVersion).filter_by(resource_id=key).count(), 1)
        self.assertNotIn('versions', admin.detail('skills', skill['id']))
        with self.assertRaises(HTTPException): admin.delete_skill(skill['id'], again['publishedVersion'])

    def test_deleted_skill_name_never_reuses_an_issued_version(self):
        first = admin.upload_skill(archive(name='reupload'))
        admin.delete_skill(first['id'], first['publishedVersion'])
        self.assertEqual(admin.list_resources('skills'), [])
        second = admin.upload_skill(archive(name='reupload'))
        self.assertGreater(second['publishedVersion'], first['publishedVersion'])

    def test_upload_rejects_traversal_symlink_and_escaped_entrypoint(self):
        for filename in ['../escape.py', '/absolute.py', 'a\\evil.py']:
            with self.assertRaises(HTTPException): admin.upload_skill(archive(extra={filename: 'bad'}))
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as z:
            link = zipfile.ZipInfo('link'); link.external_attr = (0o120777 << 16)
            z.writestr(link, '../escape')
        with self.assertRaises(HTTPException): admin.upload_skill(buffer.getvalue())
        with self.assertRaises(HTTPException):
            admin.upload_skill(archive(extra={'SKILL.md': '---\nname: test\nkind: executor\nentrypoint: ../escape.py:execute\n---\n'}))

    def test_permissions_on_every_route(self):
        from routers.admin import router
        from services.user_service import create_access_token
        from datetime import timedelta
        app = FastAPI(); app.include_router(router)
        with self.factory.begin() as session:
            session.add_all([User(username='test-admin', userpassword='unused', role='admin'), User(username='test-user', userpassword='unused', role='user')])
        with patch('routers.admin.get_session', lambda _: self.factory()):
            client = TestClient(app)
            for route in router.routes:
                path = route.path.replace('{kind}', 'agents').replace('{key}', 'missing').replace('{version}', '1')
                method = next(iter(route.methods))
                client.cookies.clear()
                self.assertEqual(client.request(method, path).status_code, 401, path)
                client.cookies.set('access_token', create_access_token({'sub': 'test-user'}, timedelta(hours=1)))
                self.assertEqual(client.request(method, path).status_code, 403, path)
            client.cookies.set('access_token', create_access_token({'sub': 'test-admin'}, timedelta(hours=1)))
            self.assertEqual(client.get('/admin/agents').status_code, 200)


    def test_knowledge_admin_operations_delegate_to_existing_service(self):
        from routers.admin import router, require_admin
        app = FastAPI(); app.include_router(router)
        app.dependency_overrides[require_admin] = lambda: 'test-admin'
        client = TestClient(app)
        with patch('services.knowledge_service.KnowledgeService.upload_knowledge', return_value={'code': 0, 'data': {'warnings': []}}) as upload, \
             patch('services.knowledge_service.KnowledgeService.search_knowledge', return_value={'results': [{'fileName': 'test.txt'}]}) as search, \
             patch('services.knowledge_service.KnowledgeService.clear_knowledge', return_value={'code': 0}) as clear:
            self.assertEqual(client.post('/admin/knowledge/upload', json={'fileName': 'test.txt', 'url': 'https://example.com/test.txt'}).json()['code'], 0)
            upload.assert_called_once_with('https://example.com/test.txt', 'test.txt')
            self.assertEqual(client.post('/admin/knowledge/search', json={'search': '测试'}).json()['data'][0]['fileName'], 'test.txt')
            search.assert_called_once_with('测试', format='json')
            self.assertEqual(client.post('/admin/knowledge/clear').json()['code'], 0)
            clear.assert_called_once()
            with patch('services.file_service.FileService.upload_file', return_value={'code': 0, 'data': {'filename': 'test.txt', 'url': 'https://example.com/test.txt'}}):
                self.assertEqual(client.post('/admin/knowledge/file', files={'file': ('test.txt', b'test', 'text/plain')}).json()['code'], 0)
        from routers.agent import router as agent_router
        from routers.file import router as file_router
        paths = {r.path for r in [*agent_router.routes, *file_router.routes]}
        self.assertFalse(paths & {'/agent/knowledge', '/agent/clear-knowledge', '/file/knowledge/upload', '/file/knowledge/clear'})

    def test_debug_resolves_model_selected_by_agent_draft(self):
        from types import SimpleNamespace
        from routers.admin import router, require_admin
        from agent.agent_service import AgentService

        workflow = admin.save('workflows', graph())
        agent = admin.save('agents', {
            'name': '调试模型解析',
            'modelId': self.model['id'],
            'workflowId': workflow['id'],
        })

        class Model:
            async def astream(self, messages):
                yield SimpleNamespace(content='调试成功', additional_kwargs={})

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_admin] = lambda: 'test-admin'
        with patch('routers.admin.get_session', lambda _: self.factory()), \
             patch('services.workflow_runtime.get_session', lambda _: self.factory()), \
             patch.object(AgentService, 'get_model', return_value=Model()) as get_model:
            response = TestClient(app).post('/admin/debug', json={
                'agentId': agent['id'],
                'text': '测试',
            })

        self.assertEqual(response.status_code, 200)
        self.assertIn('调试成功', response.text)
        runtime_config = get_model.call_args.kwargs['config']
        self.assertEqual(runtime_config['model_type'], 'ollama')
        self.assertEqual(runtime_config['model_name'], 'test')

    def test_workflow_debug_uses_selected_model_without_agent(self):
        from types import SimpleNamespace
        from routers.admin import router, require_admin
        from agent.agent_service import AgentService

        workflow = admin.save('workflows', graph())

        class Model:
            async def astream(self, messages):
                yield SimpleNamespace(content='工作流调试成功', additional_kwargs={})

        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[require_admin] = lambda: 'test-admin'
        with patch('routers.admin.get_session', lambda _: self.factory()), \
             patch('services.workflow_runtime.get_session', lambda _: self.factory()), \
             patch.object(AgentService, 'get_model', return_value=Model()) as get_model:
            response = TestClient(app).post('/admin/debug', json={
                'workflowId': workflow['id'],
                'modelId': self.model['id'],
                'text': '测试',
            })

        self.assertEqual(response.status_code, 200)
        self.assertIn('工作流调试成功', response.text)
        runtime_config = get_model.call_args.kwargs['config']
        self.assertEqual(runtime_config['model_type'], 'ollama')
        self.assertEqual(runtime_config['model_name'], 'test')
        self.assertEqual(runtime_config['agent_code'], 'workflow-debug')
        self.assertTrue(runtime_config['workflow_debug'])




class RuntimeAdapterTest(unittest.IsolatedAsyncioTestCase):
    setUp = AdminStorageTest.setUp
    tearDown = AdminStorageTest.tearDown

    async def test_both_models_use_frozen_config_and_defaults(self):
        from types import SimpleNamespace
        from unittest.mock import AsyncMock
        from services.workflow_runtime import stream_workflow
        from agent.agent_service import AgentService
        class Ollama:
            async def astream(self, messages):
                yield SimpleNamespace(content='本地回答', additional_kwargs={'reasoning_content': '推理'})
        class Stream:
            async def __aiter__(self):
                yield SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content='云端回答', reasoning_content='推理'))])
            async def close(self): pass
        create = AsyncMock(return_value=Stream())
        cloud = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
        config = {'agent_code': 'test', 'name': 'test', 'workflow': graph(), 'config_version': 7,
                  'model_type': 'ollama', 'model_name': 'test', 'support_think': True, 'default_think': True,
                  'base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1'}
        with patch('services.workflow_runtime.get_session', lambda _: self.factory()):
            for provider, client, expected in [('ollama', Ollama(), '本地回答'), ('api', cloud, '云端回答')]:
                config['model_type'] = provider
                with patch.object(AgentService, 'get_model', return_value=client) as factory:
                    events = [e async for e in stream_workflow(config, text='测试')]
                    self.assertEqual(events[-1]['content'], expected)
                    self.assertTrue(events[-1]['thinking'])
                    self.assertEqual(factory.call_args.kwargs['config']['config_version'], 7)
                    self.assertTrue(factory.call_args.kwargs['reasoning'])
            self.assertEqual(create.call_args.kwargs['extra_body'], {'enable_thinking': True})
            with self.factory() as session:
                self.assertEqual(session.query(AdminSkillLease).count(), 0)

    async def test_search_context_reaches_model_without_capability_switch(self):
        from types import SimpleNamespace
        from services.workflow_runtime import stream_workflow
        from agent.agent_service import AgentService
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as z:
            z.writestr('SKILL.md', '---\nname: web-search\nkind: executor\nentrypoint: handler.py:execute\n---\n')
            z.writestr('handler.py', 'def execute(**kwargs): return {}\n')
        skill = admin.upload_skill(raw.getvalue())
        flow = graph()
        flow['nodes'].insert(1, {'id': 'search', 'type': 'skill', 'data': {
            'skillId': skill['id'], 'skillVersion': 1, 'arguments': {'query': '{{input.text}}'}}})
        flow['edges'] = [{'source': a, 'target': b} for a, b in
                         [('start', 'search'), ('search', 'model'), ('model', 'end')]]
        captured = []
        class Model:
            async def astream(self, messages):
                captured.append(messages)
                yield SimpleNamespace(content='回答', additional_kwargs={})
        result = {'context': '最新搜索资料', 'items': [{'title': '来源', 'url': 'https://example.com'}]}
        config = {'agent_code': 'test', 'workflow': flow, 'model_type': 'ollama'}
        with patch('services.workflow_runtime.get_session', lambda _: self.factory()), \
             patch.object(AgentService, 'get_model', return_value=Model()), \
             patch('services.skill_service.SkillService.get_handler', return_value=lambda **kw: result) as handler:
            events = [e async for e in stream_workflow(config, text='问题', memory=False)]
            self.assertTrue(any('最新搜索资料' in m['content'] for m in captured[-1]))
            search = next(e['node'] for e in events if e.get('node', {}).get('id') == 'search'
                          and e['node']['status'] == 'success')
            self.assertEqual(search['name'], 'web-search')
            self.assertEqual(search['title'], 'web-search')
            self.assertEqual(search['details']['output'], result)
            self.assertEqual(events[-1]['content'], '回答')
            events = [e async for e in stream_workflow(config, text='再次提问', memory=False)]
            self.assertTrue(any('最新搜索资料' in m['content'] for m in captured[-1]))
            self.assertEqual(handler.call_count, 2)
            self.assertTrue(any(e.get('node', {}).get('id') == 'search'
                                and e['node']['status'] == 'success' for e in events))

    async def test_skill_presentation_is_preserved_in_following_model_output(self):
        from types import SimpleNamespace
        from services.workflow_runtime import stream_workflow
        from agent.agent_service import AgentService
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as z:
            z.writestr('SKILL.md', '---\nname: chart-test\nkind: executor\nentrypoint: handler.py:execute\n---\n')
            z.writestr('handler.py', 'def execute(**kwargs): return {}\n')
        skill = admin.upload_skill(raw.getvalue())
        flow = graph()
        flow['nodes'].insert(1, {'id': 'chart', 'type': 'skill', 'data': {
            'skillId': skill['id'], 'skillVersion': skill['publishedVersion'], 'arguments': {}}})
        flow['edges'] = [{'source': a, 'target': b} for a, b in
                         [('start', 'chart'), ('chart', 'model'), ('model', 'end')]]
        captured = []

        class Model:
            async def astream(self, messages):
                captured.extend(messages)
                yield SimpleNamespace(content='趋势解读', additional_kwargs={})

        presentation = '```vis line\ndata\n  - time "2026-01"\n    value 10\n```'
        config = {'agent_code': 'test', 'workflow': flow, 'model_type': 'ollama'}
        result = {'status': 'success', 'presentation': presentation, 'context': '只补充趋势'}
        with patch('services.workflow_runtime.get_session', lambda _: self.factory()), \
             patch.object(AgentService, 'get_model', return_value=Model()), \
             patch('services.skill_service.SkillService.get_handler', return_value=lambda **kw: result):
            events = [event async for event in stream_workflow(config, text='生成图表', memory=False)]

        self.assertIn(presentation, events[-1]['content'])
        self.assertIn('趋势解读', events[-1]['content'])
        self.assertTrue(any(presentation in message['content'] for message in captured))

    async def test_skill_cannot_override_identity_and_running_version_is_leased(self):
        from services.workflow_runtime import stream_workflow
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as z:
            z.writestr('SKILL.md', '---\nname: identity-test\nkind: executor\nentrypoint: handler.py:execute\n---\n')
            z.writestr('handler.py', 'def execute(requester_username, agent_code, **kwargs):\n    return {"user": requester_username, "agent": agent_code}\n')
        skill = admin.upload_skill(raw.getvalue())
        flow = graph()
        flow['nodes'][1] = {'id': 'model', 'type': 'skill', 'data': {'skillId': skill['id'], 'skillVersion': 1,
            'arguments': {'requester_username': 'forged-admin', 'agent_code': 'forged-agent'}}}
        flow['nodes'][-1]['data']['answer'] = '{{nodes.model.output.user}}'
        config = {'agent_code': 'test', 'name': 'test', 'workflow': flow}
        with patch('services.workflow_runtime.get_session', lambda _: self.factory()):
            stream = stream_workflow(config, text='test', username='actual-user', memory=False)
            await anext(stream)
            with self.assertRaises(HTTPException) as error: admin.delete_skill(skill['id'], 1)
            self.assertEqual(error.exception.status_code, 409)
            events = [e async for e in stream]
            self.assertEqual(events[-1]['content'], 'actual-user')
            admin.delete_skill(skill['id'], 1)

    async def test_cancel_keeps_lease_until_synchronous_skill_finishes(self):
        import threading
        from services.workflow_runtime import stream_workflow
        raw = io.BytesIO()
        with zipfile.ZipFile(raw, 'w') as z:
            z.writestr('SKILL.md', '---\nname: blocking-test\nkind: executor\nentrypoint: handler.py:execute\n---\n')
            z.writestr('handler.py', 'def execute(**kwargs): return {}\n')
        skill = admin.upload_skill(raw.getvalue())
        flow = graph()
        flow['nodes'][1] = {'id': 'model', 'type': 'skill', 'data': {'skillId': skill['id'], 'skillVersion': 1}}
        flow['nodes'][-1]['data']['answer'] = 'done'
        started, release = threading.Event(), threading.Event()
        def blocking(**kwargs):
            started.set()
            release.wait(5)
            return {}
        async def consume():
            return [e async for e in stream_workflow({'agent_code': 'test', 'workflow': flow}, text='test', memory=False)]
        with patch('services.workflow_runtime.get_session', lambda _: self.factory()), patch('services.skill_service.SkillService.get_handler', return_value=blocking):
            task = asyncio.create_task(consume())
            self.assertTrue(await asyncio.to_thread(started.wait, 3))
            task.cancel()
            await asyncio.sleep(0.02)
            try:
                with self.factory() as session:
                    self.assertEqual(session.query(AdminSkillLease).count(), 1)
            finally:
                release.set()
            with self.assertRaises(asyncio.CancelledError): await task
            with self.factory() as session:
                self.assertEqual(session.query(AdminSkillLease).count(), 0)


if __name__ == "__main__":
    unittest.main()
