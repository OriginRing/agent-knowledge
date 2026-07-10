import json
import uuid
from db.sqlalchemy_connection import get_session
from models.db_models import History

def add_history_record(session_id: str, username: str, agent_code: str, request_data: dict, response_data: dict):
    session = None
    try:
        session = get_session('agent-user')
        
        if not session_id:
            session_id = str(uuid.uuid4())
        
        user_record = {
            'role': 'user',
            'content': request_data.get('text', ''),
            'files': response_data.get('files', '')
        }
        
        system_record = {
            'role': 'assistant',
            'content': response_data.get('content', ''),
            'thinkMessage': response_data.get('thinkMessage', ''),
            'agentCode': agent_code,
            'knowledge': response_data.get('knowledge', [])
        }
        
        existing = session.query(History).filter_by(session_id=session_id, username=username).first()
        
        if existing:
            try:
                records = json.loads(existing.records)
            except:
                records = []
            records.append(user_record)
            records.append(system_record)
            existing.records = json.dumps(records)
            if agent_code:
                existing.agent_code = agent_code
        else:
            history = History(
                session_id=session_id,
                username=username,
                agent_code=agent_code,
                records=json.dumps([user_record, system_record])
            )
            session.add(history)
        
        session.commit()
        print(f"历史记录保存成功: username={username}, session_id={session_id}, thinkMessage_len={len(response_data.get('thinkMessage', ''))}")
        return {'code': 0, 'message': 'success', 'data': {'session_id': session_id}}
    except Exception as e:
        print(f"保存历史记录失败: {str(e)}")
        return {'code': -1, 'message': f'保存历史记录失败: {str(e)}'}
    finally:
        if session:
            session.close()

def get_history_list(username: str, agent_code: str = None):
    session = None
    try:
        session = get_session('agent-user')
        
        query = session.query(History).filter_by(username=username)
        
        if agent_code:
            query = query.filter_by(agent_code=agent_code)
        
        histories = query.order_by(History.updated_at.desc()).all()
        
        result = []
        for history in histories:
            try:
                records = json.loads(history.records)
                if records:
                    first_record = records[0]
                    second_record = records[1]
                    preview = first_record.get('content', '')[:50]
                    content = second_record.get('content', '')[:50]
                    result.append({
                        'id': history.id,
                        'session_id': history.session_id,
                        'agent_code': history.agent_code,
                        'preview': preview,
                        'content': content,
                        'record_count': len(records),
                        'created_at': str(history.created_at),
                        'updated_at': str(history.updated_at)
                    })
            except:
                pass
        
        return {'code': 0, 'message': 'success', 'data': result}
    except Exception as e:
        return {'code': -1, 'message': f'获取历史记录失败: {str(e)}'}
    finally:
        if session:
            session.close()

def get_history_detail(username: str, history_id: int = None, session_id: str = None):
    session = None
    try:
        session = get_session('agent-user')
        
        if history_id:
            history = session.query(History).filter_by(id=history_id, username=username).first()
        elif session_id:
            history = session.query(History).filter_by(session_id=session_id, username=username).first()
        else:
            return {'code': 1, 'message': '请提供id或sessionId'}
        
        if not history:
            return {'code': 1, 'message': '会话不存在'}
        
        try:
            records = json.loads(history.records)
        except:
            records = []
        
        return {
            'code': 0,
            'message': 'success',
            'data': {
                'id': history.id,
                'session_id': history.session_id,
                'agent_code': history.agent_code,
                'records': records,
                'created_at': str(history.created_at),
                'updated_at': str(history.updated_at)
            }
        }
    except Exception as e:
        return {'code': -1, 'message': f'获取历史详情失败: {str(e)}'}
    finally:
        if session:
            session.close()

def delete_history_record(history_id: int, agent_code: str, username: str):
    session = None
    try:
        session = get_session('agent-user')
        
        history = session.query(History).filter_by(
            id=history_id,
            agent_code=agent_code,
            username=username
        ).first()
        
        if not history:
            return {'code': 1, 'message': '记录不存在或权限不足'}
        
        session.delete(history)
        session.commit()
        
        print(f"历史记录删除成功: id={history_id}, username={username}, agent_code={agent_code}")
        return {'code': 0, 'message': 'success'}
    except Exception as e:
        print(f"删除历史记录失败: {str(e)}")
        return {'code': -1, 'message': f'删除历史记录失败: {str(e)}'}
    finally:
        if session:
            session.close()
