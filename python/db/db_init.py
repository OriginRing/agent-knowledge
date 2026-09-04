from sqlalchemy import text
from db.sqlalchemy_connection import create_tables, get_session
from models.db_models import AgentList
from models import admin_models  # register control-plane tables

def init_tables():
    create_tables('agent-user')
    create_tables('agent-knowledge')
    ensure_user_role()
    ensure_agent_default_skill()
    ensure_agent_slot()
    ensure_history_longtext()
    init_default_agents()
    from services.admin_service import bootstrap
    bootstrap()


def ensure_user_role():
    session = None
    try:
        session = get_session('agent-user')
        column_exists = session.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' "
            "AND COLUMN_NAME = 'role'"
        )).scalar()
        if not column_exists:
            session.execute(text(
                "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL "
                "DEFAULT 'user' COMMENT '用户角色' AFTER userpassword"
            ))
        session.execute(text(
            "UPDATE users SET role = 'user' WHERE role IS NULL OR role = ''"
        ))
        session.execute(text(
            "ALTER TABLE users MODIFY role VARCHAR(20) NOT NULL "
            "DEFAULT 'user' COMMENT '用户角色'"
        ))
        session.commit()
        print("users.role 字段初始化成功")
    except Exception as exc:
        if session:
            session.rollback()
        print(f"users.role 字段初始化失败: {exc}")
    finally:
        if session:
            session.close()


def ensure_agent_default_skill():
    session = None
    try:
        session = get_session('agent-knowledge')
        column_exists = session.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_list' "
            "AND COLUMN_NAME = 'default_skill'"
        )).scalar()
        if not column_exists:
            session.execute(text(
                "ALTER TABLE agent_list ADD COLUMN default_skill VARCHAR(100) "
                "NULL COMMENT '智能体默认启用的技能' AFTER base_url"
            ))
        session.commit()
        print("agent_list.default_skill 字段初始化成功")
    except Exception as exc:
        if session:
            session.rollback()
        print(f"agent_list.default_skill 字段初始化失败: {exc}")
    finally:
        if session:
            session.close()


SALES_AGENT_SLOTS = [
    {
        "title": "查询指定人员今年的销售额",
        "content": "查询<<xxx>>今年的销售额，并用柱状图展示",
    }
]


def ensure_agent_slot():
    """兼容已有数据库；仅向尚未配置词槽的销售助手填充模板。"""
    import json

    session = get_session('agent-knowledge')
    try:
        column_exists = session.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'agent_list' "
            "AND COLUMN_NAME = 'slot'"
        )).scalar()
        if not column_exists:
            session.execute(text(
                "ALTER TABLE agent_list ADD COLUMN slot JSON NULL COMMENT '智能体词槽模板'"
            ))
        session.execute(text(
            "UPDATE agent_list SET slot = :slot WHERE agentcode = '300001' "
            "AND (slot IS NULL OR JSON_LENGTH(slot) = 0)"
        ), {"slot": json.dumps(SALES_AGENT_SLOTS, ensure_ascii=False)})
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def ensure_history_longtext():
    session = None
    try:
        session = get_session('agent-user')
        column_type = session.execute(text(
            "SELECT DATA_TYPE FROM information_schema.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'history' "
            "AND COLUMN_NAME = 'records'"
        )).scalar()
        if column_type and column_type.lower() != 'longtext':
            session.execute(text("ALTER TABLE history MODIFY records LONGTEXT NOT NULL"))
            session.commit()
            print("history.records 已升级为 LONGTEXT")
    except Exception as exc:
        if session:
            session.rollback()
        print(f"history.records 升级检查失败: {exc}")
    finally:
        if session:
            session.close()

def init_default_agents():
    try:
        session = get_session('agent-knowledge')
        
        default_agents = [
            {'agentcode': '00001', 'agentname': 'deepseek-R1', 'model_type': 'ollama', 'model_name': 'deepseek-r1:8b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 DeepSeek-R1 8B 模型', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '00002', 'agentname': 'qwen-3.5', 'model_type': 'ollama', 'model_name': 'qwen3.5:9b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 Qwen3.5 9B 模型', 'is_default': True, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': True, 'support_download': True},
            {'agentcode': '00003', 'agentname': 'x/flux2-klein', 'model_type': 'ollama', 'model_name': 'x/flux2-klein:4b', 'api_key_name': None, 'base_url': None, 'status': 1, 'description': '本地部署的 Flux2-Klein 4B 模型', 'is_default': False, 'support_file': False, 'support_think': False, 'support_connect': False, 'support_knowledge': False, 'support_download': False},
            {'agentcode': '200001', 'agentname': 'Qwen-API', 'model_type': 'api', 'model_name': 'qwen3.7-plus', 'api_key_name': 'QWEN_API_KEY', 'base_url': 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'status': 1, 'description': '阿里云百炼 Qwen API', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': False, 'support_download': True},
            {'agentcode': '200002', 'agentname': 'DeepSeek API', 'model_type': 'api', 'model_name': 'deepseek-chat', 'api_key_name': 'DEEPSEEK_API_KEY', 'base_url': 'https://api.deepseek.com/v1', 'status': 1, 'description': 'DeepSeek 官方 API', 'is_default': False, 'support_file': False, 'support_think': True, 'support_connect': True, 'support_knowledge': False, 'support_download': True},
            {'agentcode': '200003', 'agentname': 'ChatGPT', 'model_type': 'api', 'model_name': 'gpt-4o-mini', 'api_key_name': 'OPENAI_API_KEY', 'base_url': 'https://api.openai.com/v1', 'status': 1, 'description': 'OpenAI ChatGPT API', 'is_default': False, 'support_file': True, 'support_think': True, 'support_connect': True, 'support_knowledge': False, 'support_download': True},
            {'agentcode': '300001', 'agentname': '销售业绩助手', 'model_type': 'ollama', 'model_name': 'qwen3.5:9b', 'api_key_name': None, 'base_url': None, 'default_skill': 'sales-performance', 'status': 1, 'description': '查询并分析授权范围内的销售业绩', 'is_default': False, 'support_file': False, 'support_think': False, 'support_connect': False, 'support_knowledge': False, 'support_download': True}
        ]
        
        for agent_data in default_agents:
            existing = session.query(AgentList).filter_by(agentcode=agent_data['agentcode']).first()
            if not existing:
                agent = AgentList(**agent_data)
                if agent_data['agentcode'] == '300001':
                    agent.slot = SALES_AGENT_SLOTS
                session.add(agent)
        
        session.commit()
        session.close()
        print("agent_list 默认数据初始化成功")
    except Exception as e:
        print(f"初始化 agent_list 默认数据失败: {e}")

if __name__ == "__main__":
    init_tables()
