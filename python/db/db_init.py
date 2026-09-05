from sqlalchemy import text
from db.sqlalchemy_connection import create_tables, get_session
from models.db_models import AgentList
from models import admin_models  # register control-plane tables

def init_tables():
    create_tables('agent-user')
    create_tables('agent-knowledge')
    ensure_user_role()
    ensure_agent_slot()
    ensure_agent_model_id()
    ensure_history_longtext()
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
    """Legacy schema compatibility only; workflow execution never reads this field."""
    session = None
    try:
        session = get_session('agent-knowledge')
        exists = session.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'agent_list' AND COLUMN_NAME = 'default_skill'"
        )).scalar()
        if not exists:
            session.execute(text(
                "ALTER TABLE agent_list ADD COLUMN default_skill VARCHAR(100) NULL "
                "COMMENT '旧字段（工作流执行不使用）'"
            ))
        session.commit()
    except Exception:
        if session:
            session.rollback()
        raise
    finally:
        if session:
            session.close()


def ensure_agent_slot():
    """Ensure the projection column exists; workflows own all behavior."""
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
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def ensure_agent_model_id():
    session = get_session('agent-knowledge')
    try:
        exists = session.execute(text(
            "SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() "
            "AND TABLE_NAME = 'agent_list' AND COLUMN_NAME = 'model_id'"
        )).scalar()
        if not exists:
            session.execute(text("ALTER TABLE agent_list ADD COLUMN model_id VARCHAR(64) NULL AFTER agentname"))
        session.execute(text("ALTER TABLE agent_list MODIFY model_type VARCHAR(20) NULL"))
        session.execute(text("ALTER TABLE agent_list MODIFY model_name VARCHAR(200) NULL"))
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

if __name__ == "__main__":
    init_tables()
