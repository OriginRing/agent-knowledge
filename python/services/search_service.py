import os

from tavily import TavilyClient


class SearchService:
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            api_key = os.getenv("TAVILY_API_KEY")
            if not api_key:
                raise ValueError("TAVILY_API_KEY 未配置")
            cls._client = TavilyClient(api_key=api_key)
        return cls._client

    @classmethod
    def search(cls, query: str, max_results: int = 3) -> dict:
        result = cls.get_client().search(
            query=query,
            max_results=max_results,
            language="zh",
        )
        items = [
            {
                "title": item.get("title", ""),
                "content": item.get("content", ""),
                "url": item.get("url", ""),
            }
            for item in result.get("results", [])
        ]
        context = "\n".join(
            f"{index + 1}. {item['title']}：{item['content']}\n来源：{item['url']}"
            for index, item in enumerate(items)
        )
        return {"query": query, "items": items, "context": context or "未找到相关信息"}
