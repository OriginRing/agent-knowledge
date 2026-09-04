"""Versioned control-plane records, separate from the public agent projection."""
from sqlalchemy import Column, String, Integer, JSON, UniqueConstraint
from db.sqlalchemy_connection import Base


class AdminResource(Base):
    __tablename__ = 'admin_resources'
    id = Column(String(64), primary_key=True)
    kind = Column(String(20), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    revision = Column(Integer, nullable=False, default=1)
    draft = Column(JSON, nullable=False)
    published_version = Column(Integer, nullable=True)
    online = Column(Integer, nullable=False, default=0)


class AdminVersion(Base):
    __tablename__ = 'admin_versions'
    __table_args__ = (UniqueConstraint('resource_id', 'version'),)
    id = Column(Integer, primary_key=True, autoincrement=True)
    resource_id = Column(String(64), nullable=False, index=True)
    version = Column(Integer, nullable=False)
    payload = Column(JSON, nullable=False)


class AdminDebugRun(Base):
    __tablename__ = 'admin_debug_runs'
    id = Column(String(64), primary_key=True)
    username = Column(String(50), nullable=False)
    events = Column(JSON, nullable=False)
    status = Column(String(20), nullable=False)


class AdminSkillLease(Base):
    """Persistent leases protect running debug requests across backend workers."""
    __tablename__ = 'admin_skill_leases'
    run_id = Column(String(64), primary_key=True)
    skill_id = Column(String(64), primary_key=True)
    skill_version = Column(Integer, primary_key=True)
