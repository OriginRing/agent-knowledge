from services.search_service import SearchService


def execute(query: str, **_) -> dict:
    return SearchService.search(query)
