import json
from typing import List, Dict, Any

class HistoryManager:
    
    @classmethod
    def get_history_messages(cls, username: str, session_id: str, max_tokens: int = 4096) -> List[Dict[str, str]]:
        from services.history_service import get_history_detail
        
        history_result = get_history_detail(username, session_id=session_id)
        
        if history_result.get('code') != 0 or not history_result.get('data', {}).get('records'):
            return []
        
        records = history_result['data']['records']
        
        messages = []
        for record in records:
            role = record.get('role', 'user')
            content = record.get('content', '')
            if content:
                messages.append({'role': role, 'content': content})
        
        return cls._trim_messages(messages, max_tokens)
    
    @classmethod
    def _trim_messages(cls, messages: List[Dict[str, str]], max_tokens: int) -> List[Dict[str, str]]:
        try:
            from langchain_core.messages import trim_messages
            from langchain_core.messages import count_tokens_approximately
            
            trimmed_messages = trim_messages(
                messages,
                max_tokens=max_tokens,
                strategy="last",
                token_counter=count_tokens_approximately,
                include_system=True,
                start_on="human",
                end_on=("human", "tool"),
                allow_partial=False
            )
            
            result = []
            for msg in trimmed_messages:
                result.append({'role': msg.role, 'content': msg.content})
            
            return result
        except Exception as e:
            print(f"[HistoryManager] trim_messages 失败: {e}")
            return messages