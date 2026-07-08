from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config.db_config import DB_CONFIG

Base = declarative_base()

_engines = {}
_sessions = {}

def get_engine(db_name):
    if db_name not in DB_CONFIG:
        raise ValueError(f"数据库配置不存在: {db_name}")
    
    if db_name not in _engines:
        config = DB_CONFIG[db_name]
        db_url = f"mysql+pymysql://{config['user']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}?charset={config['charset']}"
        _engines[db_name] = create_engine(db_url, pool_pre_ping=True)
    
    return _engines[db_name]

def get_session(db_name):
    if db_name not in _sessions:
        engine = get_engine(db_name)
        _sessions[db_name] = sessionmaker(bind=engine)
    
    return _sessions[db_name]()

def create_tables(db_name):
    engine = get_engine(db_name)
    Base.metadata.create_all(engine)
    print(f"{db_name} 表创建成功")