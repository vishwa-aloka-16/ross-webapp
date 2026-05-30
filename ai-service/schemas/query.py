from pydantic import BaseModel


class QueryRequest(BaseModel):
    ownerId: str
    documentId: str
    question: str


class Citation(BaseModel):
    node_id: str
    node_type: str
    level: int
    page_start: int | None = None
    page_end: int | None = None
    snippet: str


class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    matched_nodes: list[dict]
    document_id: str
