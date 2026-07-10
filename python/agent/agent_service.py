import os
import json
import asyncio
from dotenv import load_dotenv
from openai import AsyncOpenAI
from langchain_ollama import ChatOllama
from tavily import TavilyClient
from db.sqlalchemy_connection import get_session
from models.db_models import AgentList

load_dotenv()

_tavily_client = None

def get_tavily_client():
    global _tavily_client
    if _tavily_client is None:
        api_key = os.getenv("TAVILY_API_KEY")
        if not api_key:
            raise ValueError("TAVILY_API_KEY 未配置")
        _tavily_client = TavilyClient(api_key=api_key)
    return _tavily_client

def web_search(query: str) -> str:
    try:
        client = get_tavily_client()
        result = client.search(query=query, max_results=3, language="zh")
        results = result.get("results", [])
        if results:
            return "\n".join([f"{i+1}. {r.get('title', '')}： {r.get('content', '')}\n" for i, r in enumerate(results)])
        return "未找到相关信息"
    except Exception as e:
        return f"搜索错误: {str(e)}"

def retrieve_knowledge(query: str):
    try:
        from services.knowledge_service import KnowledgeService
        result = KnowledgeService.search_knowledge(query, k=3, format="text")
        return result["knowledge_text"], result["knowledge_items"]
    except Exception as e:
        print(f"知识库检索错误: {e}")
        return "", []

class AgentService:
    _models = {}

    @classmethod
    def get_agent_config(cls, agent_code):
        session = None
        try:
            session = get_session('agent-knowledge')
            agent = session.query(AgentList).filter_by(agentcode=agent_code, status=1).first()
            
            if not agent:
                return None
            
            return {
                'id': agent.id,
                'agent_code': agent.agentcode,
                'agent_name': agent.agentname,
                'model_type': agent.model_type,
                'model_name': agent.model_name,
                'api_key_name': agent.api_key_name,
                'base_url': agent.base_url,
                'status': agent.status,
                'description': agent.description,
                'is_default': agent.is_default,
                'support_file': agent.support_file,
                'support_think': agent.support_think,
                'support_connect': agent.support_connect,
                'support_knowledge': agent.support_knowledge,
                'support_download': agent.support_download
            }
        except Exception as e:
            print(f"获取 agent 配置失败: {e}")
            return None
        finally:
            if session:
                session.close()

    @classmethod
    def get_model(cls, agent_code, reasoning=False):
        cache_key = f"{agent_code}_{reasoning}"
        if cache_key in cls._models:
            return cls._models[cache_key]
        
        config = cls.get_agent_config(agent_code)
        if not config:
            raise ValueError(f"agent_code 不存在或已禁用: {agent_code}")
        
        model_type = config['model_type']
        
        if model_type == 'api':
            api_key = os.getenv(config['api_key_name'])
            if not api_key:
                raise ValueError(f"API密钥未配置: {config['api_key_name']}")
            
            client = AsyncOpenAI(
                api_key=api_key,
                base_url=config['base_url']
            )
            cls._models[cache_key] = client
            return client
        
        elif model_type == 'ollama':
            model = ChatOllama(
                model=config['model_name'],
                streaming=True,
                reasoning=reasoning
            )
            cls._models[cache_key] = model
            return model
        
        else:
            return None

    @classmethod
    def _get_thinking_kwargs(cls, base_url, model_name, thinking):
        if not thinking:
            if 'dashscope' in base_url:
                return {"extra_body": {"enable_thinking": False}}
            else:
                return {}
        
        if 'dashscope' in base_url:
            return {"extra_body": {"enable_thinking": True}}
        elif 'deepseek' in base_url:
            return {"extra_body": {"thinking": {"type": "enabled"}}}
        elif 'openai' in base_url:
            if 'o1' in model_name.lower():
                return {"reasoning": {"effort": "high"}}
            else:
                return {"extra_body": {"reasoning": {"effort": "high"}}}
        return {}

    @classmethod
    async def chat_stream(cls, agent_code, text, files=None, thinking=False, knowledge=False, connect=False, session_id=None, username=None):
        if isinstance(files, str):
            files = [f.strip() for f in files.split(',') if f.strip()]
        else:
            files = files or []
        
        config = cls.get_agent_config(agent_code)
        if not config:
            yield json.dumps({'error': f'agent_code 不存在或已禁用: {agent_code}'})
            return
        
        try:
            actual_thinking = thinking and config.get('support_think', False)
            actual_knowledge = knowledge and config.get('support_knowledge', False)
            actual_connect = connect and config.get('support_connect', False)
            actual_file = files is not None and len(files) > 0 and config.get('support_file', False)
            
            knowledge_items = []
            processed_files = []
            
            if actual_knowledge:
                yield json.dumps({
                    'content': '',
                    'thinkMessage': '[正在检索知识库...]<br>',
                    'agentCode': config['agent_code'],
                    'agentName': config['agent_name'],
                    'thinking': actual_thinking,
                    'knowledge': actual_knowledge,
                    'connect': actual_connect,
                    'done': False
                })
                
                knowledge_result, knowledge_items = await asyncio.to_thread(retrieve_knowledge, text)
                
                if knowledge_result:
                    text = knowledge_result + text
                else:
                    text = "[注意：知识库为空，将直接回答问题]\n" + text
            
            model_type = config['model_type']
            
            history_messages = []
            if session_id and username:
                from agent.history_manager import HistoryManager
                history_messages = await asyncio.to_thread(
                    HistoryManager.get_history_messages,
                    username,
                    session_id,
                    max_tokens=int(os.getenv('MAX_TOKENS', 4096))
                )
            if actual_file:
                yield json.dumps({
                    'content': '',
                    'thinkMessage': '[正在处理文件...]<br>',
                    'agentCode': config['agent_code'],
                    'agentName': config['agent_name'],
                    'thinking': actual_thinking,
                    'knowledge': actual_knowledge,
                    'connect': actual_connect,
                    'done': False
                })
                
                if model_type == 'ollama':
                    file_text = await asyncio.to_thread(
                        cls._process_files_for_ollama,
                        files
                    )
                    
                    if file_text:
                        text = file_text + text
                elif model_type == 'api':
                    processed_files = await asyncio.to_thread(
                        cls._process_files_for_api,
                        files
                    )
            
            if model_type == 'ollama':
                async for chunk in cls._chat_stream_ollama(config, text, actual_thinking, actual_connect, knowledge_items, history_messages):
                    yield chunk
            elif model_type == 'api':
                async for chunk in cls._chat_stream_api(config, text, actual_thinking, actual_connect, processed_files, history_messages):
                    yield chunk
            
        except StopAsyncIteration:
            pass
        except Exception as e:
            yield json.dumps({'error': f'对话失败: {str(e)}', 'done': True})

    @classmethod
    def _process_files_for_ollama(cls, file_urls):
        from services.file_process_service import FileProcessService
        return FileProcessService.process_files_for_ollama(file_urls)

    @classmethod
    def _process_files_for_api(cls, file_urls):
        from services.file_process_service import FileProcessService
        return FileProcessService.process_files_for_api(file_urls)

    @classmethod
    async def _chat_stream_ollama(cls, config, text, thinking=False, connect=False, knowledge_items=None, history_messages=None):
        knowledge_items = knowledge_items or []
        history_messages = history_messages or []
        
        if connect:
            yield json.dumps({
                'content': '',
                'thinkMessage': '[正在搜索...]<br>',
                'agentCode': config['agent_code'],
                'agentName': config['agent_name'],
                'thinking': thinking,
                'knowledge': config.get('support_knowledge', False),
                'connect': connect,
                'done': False
            })
            
            search_result = await asyncio.to_thread(web_search, text)
            
            if search_result and '搜索错误' not in search_result and '搜索失败' not in search_result:
                text = f"【搜索参考信息】\n{search_result}\n\n请基于以上搜索信息回答用户问题：{text}"
        
        model = cls.get_model(config['agent_code'], reasoning=thinking)
        
        messages = history_messages + [{'role': 'user', 'content': text}]
        
        async for chunk in model.astream(messages):
            content = chunk.content or ""
            think_msg = chunk.additional_kwargs.get('reasoning_content', '')
            
            yield json.dumps({
                'content': content,
                'thinkMessage': think_msg,
                'agentCode': config['agent_code'],
                'agentName': config['agent_name'],
                'thinking': thinking,
                'knowledge': knowledge_items,
                'connect': connect,
                'done': False
            })
        
        yield json.dumps({
            'content': '',
            'thinkMessage': '',
            'agentCode': config['agent_code'],
            'agentName': config['agent_name'],
            'thinking': thinking,
            'knowledge': knowledge_items,
            'connect': connect,
            'done': True
        })

    @classmethod
    async def _chat_stream_api(cls, config, text, thinking=False, connect=False, processed_files=None, history_messages=None):
        processed_files = processed_files or []
        history_messages = history_messages or []
        
        client = cls.get_model(config['agent_code'])
        
        system_prompt = ""
        
        if connect:
            system_prompt = "你具备联网搜索能力。当用户询问需要最新信息的问题（如天气、新闻、实时数据等）时，请调用 web_search 工具获取最新信息，然后基于搜索结果进行回答。"
        
        messages = history_messages + []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        
        if processed_files:
            content_items = processed_files.copy()
            content_items.append({"type": "text", "text": text})
            messages.append({'role': 'user', 'content': content_items})
        else:
            messages.append({'role': 'user', 'content': text})
        
        tools = None
        if connect:
            tools = [{
                'type': 'function',
                'function': {
                    'name': 'web_search',
                    'description': '联网搜索工具，用于获取最新信息，如新闻、天气、实时数据等',
                    'parameters': {
                        'type': 'object',
                        'properties': {
                            'query': {
                                'type': 'string',
                                'description': '搜索查询词'
                            }
                        },
                        'required': ['query']
                    }
                }
            }]
        
        tool_calls = []
        pending_content = ""
        
        thinking_kwargs = cls._get_thinking_kwargs(config['base_url'], config['model_name'], thinking)
        
        stream = await client.chat.completions.create(
            model=config['model_name'],
            messages=messages,
            tools=tools,
            stream=True,
            **thinking_kwargs
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            
            if delta.tool_calls:
                for tc in delta.tool_calls:
                    if tc.index is not None:
                        while tc.index >= len(tool_calls):
                            tool_calls.append({'id': '', 'type': 'function', 'function': {'name': '', 'arguments': ''}})
                        if tc.id:
                            tool_calls[tc.index]['id'] = tc.id
                        if tc.function.name:
                            tool_calls[tc.index]['function']['name'] = tc.function.name
                        if tc.function.arguments:
                            tool_calls[tc.index]['function']['arguments'] += tc.function.arguments
            
            content = delta.content or ""
            reasoning_content = getattr(delta, 'reasoning_content', '') or ""
            
            if content or reasoning_content:
                pending_content += content
                
                yield json.dumps({
                    'content': content,
                    'thinkMessage': reasoning_content,
                    'agentCode': config['agent_code'],
                    'agentName': config['agent_name'],
                    'thinking': thinking,
                    'connect': connect,
                    'done': False
                })
        
        if tool_calls:
            for tool_call in tool_calls:
                tool_name = tool_call['function']['name']
                try:
                    tool_args = json.loads(tool_call['function']['arguments'])
                except:
                    tool_args = {}
                query = tool_args.get("query", "")
                
                yield json.dumps({
                    'content': '',
                    'thinkMessage': f'[正在搜索: {query}]<br>',
                    'agentCode': config['agent_code'],
                    'agentName': config['agent_name'],
                    'thinking': thinking,
                    'connect': connect,
                    'done': False
                })
                
                search_result = await asyncio.to_thread(web_search, query)
                
                messages.append({
                    'role': 'assistant',
                    'content': pending_content,
                    'tool_calls': [tool_call]
                })
                messages.append({
                    'role': 'tool',
                    'tool_call_id': tool_call['id'],
                    'content': search_result
                })
            
            stream = await client.chat.completions.create(
                model=config['model_name'],
                messages=messages,
                stream=True,
                **thinking_kwargs
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content or ""
                reasoning_content = getattr(chunk.choices[0].delta, 'reasoning_content', '') or ""
                
                yield json.dumps({
                    'content': content,
                    'thinkMessage': reasoning_content,
                    'agentCode': config['agent_code'],
                    'agentName': config['agent_name'],
                    'thinking': thinking,
                    'connect': connect,
                    'done': False
                })
        
        yield json.dumps({
            'content': '',
            'thinkMessage': '',
            'agentCode': config['agent_code'],
            'agentName': config['agent_name'],
            'thinking': thinking,
            'knowledge': config.get('support_knowledge', False),
            'connect': connect,
            'done': True
        })

    @classmethod
    def get_agent_list(cls):
        session = None
        try:
            session = get_session('agent-knowledge')
            agents = session.query(AgentList).order_by(AgentList.id).all()
            
            result = []
            for agent in agents:
                result.append({
                    'id': agent.id,
                    'agentCode': agent.agentcode,
                    'agentName': agent.agentname,
                    'agentValue': agent.model_name,
                    'model_type': agent.model_type,
                    'status': agent.status,
                    'description': agent.description,
                    'default': agent.is_default,
                    'supportFile': agent.support_file,
                    'supportThink': agent.support_think,
                    'supportConnect': agent.support_connect,
                    'supportKnowledge': agent.support_knowledge,
                    'supportDownload': agent.support_download
                })
            
            return {'code': 0, 'message': 'success', 'data': result}
        except Exception as e:
            return {'code': -1, 'message': f'获取 agent 列表失败: {str(e)}'}
        finally:
            if session:
                session.close()