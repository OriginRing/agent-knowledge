from services.knowledge_service import KnowledgeService


def execute(query: str, **_) -> dict:
    result = KnowledgeService.search_knowledge(query, k=3, format="text")
    return {
        "context": result.get("knowledge_text", ""),
        "items": result.get("knowledge_items", []),
        "query": query,
    }
