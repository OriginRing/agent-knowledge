from sqlalchemy import Column, Integer, String, Text, TIMESTAMP, Boolean, JSON
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.sql import func
from db.sqlalchemy_connection import Base

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'comment': '用户表'}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, unique=True, comment='用户名（纯数字）')
    userpassword = Column(String(255), nullable=False, comment='密码')
    role = Column(
        String(20),
        nullable=False,
        default='user',
        server_default='user',
        comment='用户角色',
    )
    avatar = Column(String(500), nullable=True, comment='头像URL')
    nickname = Column(String(100), nullable=True, comment='昵称')
    gender = Column(Integer, nullable=True, comment='性别：0-女，1-男')
    age = Column(Integer, nullable=True, comment='年龄')
    memory = Column(Boolean, default=False, comment='记忆开关')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='更新时间')

class AgentList(Base):
    __tablename__ = 'agent_list'
    __table_args__ = {'comment': '智能体列表'}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    agentcode = Column(String(6), nullable=False, unique=True, comment='智能体标识（六位数字）')
    agentname = Column(String(100), nullable=False, comment='智能体名称')
    model_id = Column(String(64), nullable=True, comment='模型配置标识')
    model_type = Column(String(20), nullable=True, comment='旧模型类型（已迁移）')
    model_name = Column(String(200), nullable=True, comment='旧模型名称（已迁移）')
    api_key_name = Column(String(100), nullable=True, comment='API密钥名称（.env中的key）')
    base_url = Column(String(500), nullable=True, comment='API基础URL')
    default_skill = Column(
        String(100),
        nullable=True,
        comment='智能体默认启用的技能',
    )
    slot = Column(JSON, nullable=True, default=list, comment='智能体词槽模板')
    status = Column(Integer, default=1, comment='状态：0-禁用，1-启用')
    description = Column(Text, nullable=True, comment='描述')
    is_default = Column(Boolean, default=False, comment='是否默认')
    support_file = Column(Boolean, default=False, comment='是否支持文件')
    support_think = Column(Boolean, default=False, comment='是否支持思考模式')
    support_download = Column(Boolean, default=False, comment='是否支持下载')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='更新时间')

class History(Base):
    __tablename__ = 'history'
    __table_args__ = {'comment': '对话历史表'}
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(50), nullable=False, comment='会话ID')
    username = Column(String(50), nullable=False, comment='用户名')
    agent_code = Column(String(6), nullable=True, comment='智能体标识')
    records = Column(LONGTEXT, nullable=False, comment='版本化完整对话记录（JSON格式）')
    created_at = Column(TIMESTAMP, server_default=func.now(), comment='创建时间')
    updated_at = Column(TIMESTAMP, server_default=func.now(), onupdate=func.now(), comment='更新时间')
