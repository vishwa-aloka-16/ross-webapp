from pydantic import BaseModel


class IngestionRequest(BaseModel):
    documentId: str
    ownerId: str
    fileName: str
    storagePath: str
    layoutStrategy: str = "TRANSACTIONAL"


class IngestionStatusResponse(BaseModel):
    documentId: str
    status: str
    error: str | None = None
