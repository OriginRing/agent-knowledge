from db.sqlalchemy_connection import create_tables, get_session
from models.db_models import AgentList

def init_tables():
    create_tables('agent-user')
    create_tables('agent-knowledge')
    init_default_agents()

def init_default_agents():
    try:
        session = get_session('agent-knowledge')
        
        default_agents = [
            {'agentcode': '00001', 'agentname': 'deepseek-R1', 'model_type': 'ollama', 'model_name': 'deepseek-r1:8b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 DeepSeek-R1 8B 模型', 'is_default': False, 'support_file': False, 'support_think': True, 'support_connect': False, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '00002', 'agentname': 'qwen-3.5', 'model_type': 'ollama', 'model_name': 'qwen3.5:9b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 Qwen3.5 9B 模型', 'is_default': True, 'support_file': True, 'support_think': False, 'support_connect': True, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '00003', 'agentname': 'x/flux2-klein', 'model_type': 'ollama', 'model_name': 'x/flux2-klein:4b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 Flux2-Klein 4B 模型', 'is_default': False, 'support_file': False, 'support_think': False, 'support_connect': False, 'support_knowledge': False, 'support_download': False},
            {'agentcode': '200001', 'agentname': 'Qwen-API', 'model_type': 'api', 'model_name': 'qwen3.7-plus', 'api_key_name': 'QWEN_API_KEY', 'base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'status': 1, 'description': '阿里云百炼 Qwen API', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '200002', 'agentname': 'DeepSeek API', 'model_type': 'api', 'model_name': 'deepseek-chat', 'api_key_name': 'DEEPSEEK_API_KEY', 'base_url': 'https://api.deepseek.com/v1', 'status': 1, 'description': 'DeepSeek 官方 API', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '200003', 'agentname': 'ChatGPT', 'model_type': 'api', 'model_name': 'gpt-4o-mini', 'api_key_name': 'OPENAI_API_KEY', 'base_url': 'https://api.openai.com/v1', 'status': 1, 'description': 'OpenAI ChatGPT API', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': True, 'support_download': True}
        ]
        
        for agent_data in default_agents:
            existing = session.query(AgentList).filter_by(agentcode=agent_data['agentcode']).first()
            if not existing:
                agent = AgentList(**agent_data)
                session.add(agent)
        
        session.commit()
        session.close()
        print("agent_list 默认数据初始化成功")
    except Exception as e:
        print(f"初始化 agent_list 默认数据失败: {e}")

if __name__ == "__main__":
    init_tables()