"""Small, deterministic DAG interpreter. References never evaluate Python code."""
import asyncio
import json
import re
import time

REF = re.compile(r'\{\{\s*([\w.-]+)\s*\}\}')
KINDS = {'start', 'model', 'skill', 'condition', 'end'}
OPS = {'eq', 'ne', 'contains', 'gt', 'gte', 'lt', 'lte', 'exists'}
NODE_TITLES = {'start': '开始', 'model': '模型', 'skill': 'Skill',
               'condition': '条件分支', 'end': '结束'}


def lookup(path, context):
    value = context
    for key in path.split('.'):
        if isinstance(value, dict) and key in value:
            value = value[key]
        elif isinstance(value, list) and key.isdigit() and int(key) < len(value):
            value = value[int(key)]
        else:
            raise ValueError(f'变量不存在: {path}')
    return value


def resolve(value, context):
    if isinstance(value, dict):
        return {k: resolve(v, context) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve(v, context) for v in value]
    if not isinstance(value, str):
        return value
    match = REF.fullmatch(value)
    if match:
        return lookup(match.group(1), context)
    return REF.sub(lambda m: as_text(lookup(m.group(1), context)), value)


def as_text(value):
    return value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)


def skill_handoff(output):
    """Expose the full Skill result while keeping nested data fields convenient."""
    if not isinstance(output, dict):
        return output
    data = output.get('data')
    return {**output, **data} if isinstance(data, dict) else output


def validate_graph(graph, skill_resolver=None, agent_code=None):
    nodes, edges = graph.get('nodes', []), graph.get('edges', [])
    if not isinstance(nodes, list) or not isinstance(edges, list):
        raise ValueError('nodes 和 edges 必须是数组')
    if any(not isinstance(n, dict) or not isinstance(n.get('id'), str) or not isinstance(n.get('type'), str) or not isinstance(n.get('data', {}), dict) for n in nodes):
        raise ValueError('节点必须包含字符串 id、type 和对象 data')
    if any(not isinstance(e, dict) or not isinstance(e.get('source'), str) or not isinstance(e.get('target'), str) for e in edges):
        raise ValueError('连线必须包含 source 和 target')
    if not nodes or len(nodes) > 100 or len(edges) > 200:
        raise ValueError('工作流需包含 1–100 个节点，最多 200 条连线')
    by_id = {n['id']: n for n in nodes}
    if len(by_id) != len(nodes) or any(not re.fullmatch(r'[A-Za-z][\w-]{0,63}', x) for x in by_id):
        raise ValueError('节点 ID 必须唯一且以字母开头，不可包含点号')
    starts = [n['id'] for n in nodes if n['type'] == 'start']
    if len(starts) != 1 or not any(n['type'] == 'end' for n in nodes):
        raise ValueError('必须有一个开始节点和至少一个结束节点')
    incoming = {i: [] for i in by_id}
    outgoing = {i: [] for i in by_id}
    for edge in edges:
        if edge['source'] not in by_id or edge['target'] not in by_id:
            raise ValueError('连线引用了不存在的节点')
        outgoing[edge['source']].append(edge)
        incoming[edge['target']].append(edge['source'])
    if incoming[starts[0]]:
        raise ValueError('开始节点不能有入边')
    for node in nodes:
        kind, data, links = node['type'], node.get('data', {}), outgoing[node['id']]
        if kind not in KINDS:
            raise ValueError(f'不支持的节点类型: {kind}')
        if kind == 'end' and links:
            raise ValueError('结束节点不能有出边')
        if kind in {'start', 'model', 'skill'} and len(links) != 1:
            raise ValueError('开始、模型及 Skill 节点必须有一个后继')
        if kind == 'condition':
            if len(links) != 2 or {e.get('sourceHandle') for e in links} != {'true', 'false'}:
                raise ValueError('条件节点必须分别连接 true 和 false 出口')
            if data.get('operator') not in OPS:
                raise ValueError('条件比较运算符无效')
        if kind == 'skill':
            if skill_resolver:
                if not isinstance(data.get('skillId'), str) or type(data.get('skillVersion')) is not int or data['skillVersion'] < 1:
                    raise ValueError('Skill 节点必须选择固定版本')
                skill_resolver(data['skillId'], data['skillVersion'], agent_code)
            if not isinstance(data.get('arguments', {}), dict):
                raise ValueError('Skill 调用参数必须为对象')
    visiting, visited, order = set(), set(), []
    def visit(key):
        if key in visiting:
            raise ValueError('工作流不能包含循环')
        if key in visited:
            return
        visiting.add(key)
        for edge in outgoing[key]:
            visit(edge['target'])
        visiting.remove(key)
        visited.add(key)
        order.append(key)
    visit(starts[0])
    if len(visited) != len(nodes):
        raise ValueError('存在无法从开始节点到达的节点')
    # A reference must dominate the consumer on every possible execution path.
    dominators = {}
    for key in reversed(order):
        parents = incoming[key]
        prior = set.intersection(*(dominators[p] for p in parents)) if parents else set()
        for path in REF.findall(json.dumps(by_id[key].get('data', {}), ensure_ascii=False)):
            root = path.split('.')[0]
            if root not in {'input', 'nodes'}:
                raise ValueError(f'未知变量: {path}')
            if root == 'nodes' and (len(path.split('.')) < 3 or path.split('.')[1] not in prior):
                raise ValueError(f'变量不是必经上游节点的输出: {path}')
            if root == 'input' and path.split('.')[1:] not in [['text'], ['files'], ['thinking'], ['knowledge'], ['connect']]:
                raise ValueError(f'未知输入变量: {path}')
        dominators[key] = prior | {key}
    return graph


def compare(left, operator, right):
    if operator == 'exists':
        return left is not None and left != ''
    if operator == 'eq':
        return left == right
    if operator == 'ne':
        return left != right
    if operator == 'contains':
        return right in left
    if operator == 'gt':
        return left > right
    if operator == 'gte':
        return left >= right
    if operator == 'lt':
        return left < right
    return left <= right


async def execute_graph(graph, inputs, model_call, skill_call):
    """Yield UI-compatible events. Cancellation propagates; no following node runs."""
    validate_graph(graph)
    nodes = {n['id']: n for n in graph['nodes']}
    context = {'input': inputs, 'nodes': {}}
    last_skill_output = {}
    current = next(n['id'] for n in graph['nodes'] if n['type'] == 'start')
    while current:
        node = nodes[current]
        kind = node['type']
        started = time.monotonic()
        data = node.get('data', {})
        semantic_name = data.get('skillName') if kind == 'skill' else kind
        title = str(data.get('label') or '').strip() or data.get('skillName') or NODE_TITLES[kind]
        display = {'id': current, 'kind': kind if kind in {'model', 'skill'} else 'pipeline',
                   'name': semantic_name or kind, 'title': title, 'summary': title}
        yield {'event': 'node', 'node': {**display, 'status': 'running', 'details': {}}}
        try:
            data = resolve(data, context)
            if kind == 'start':
                output = inputs
            elif kind == 'model':
                output = await model_call(data)
            elif kind == 'skill':
                arguments = dict(data.get('arguments') or {})
                arguments.setdefault('upstream_data', last_skill_output)
                data = {**data, 'arguments': arguments}
                output = await skill_call(data)
                if output.get('stopPipeline'):
                    raise ValueError(output.get('directResponse') or 'Skill 拒绝继续执行')
                last_skill_output = skill_handoff(output)
            elif kind == 'condition':
                output = compare(data.get('left'), data['operator'], data.get('right'))
            else:
                output = {'content': as_text(data.get('answer', '')), 'artifacts': data.get('artifacts', [])}
                if not isinstance(output['artifacts'], list):
                    raise ValueError('结束节点产物必须为数组')
            context['nodes'][current] = {'output': output}
            yield {'event': 'node', 'node': {**display, 'status': 'success', 'details': {
                'input': data, 'output': output, 'elapsedMs': round((time.monotonic() - started) * 1000)}}}
            if kind == 'end':
                yield {'event': 'message', 'content': output['content'], 'artifacts': output['artifacts'], 'done': True}
                return
            links = [e for e in graph['edges'] if e['source'] == current]
            if kind == 'condition':
                links = [e for e in links if e.get('sourceHandle') == str(output).lower()]
            current = links[0]['target']
            await asyncio.sleep(0)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            yield {'event': 'error', 'done': True, 'error': str(exc), 'node': {
                **display, 'status': 'error', 'details': {'error': str(exc),
                'elapsedMs': round((time.monotonic() - started) * 1000)}}}
            return
