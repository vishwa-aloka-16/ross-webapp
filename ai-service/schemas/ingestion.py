from pydantic import BaseModel


class IngestionRequest(BaseModel):
    documentId: str
    ownerId: str
    fileName: str
    storagePath: str
    layoutStrategy: str = "TRANSACTIONAL"
    fileIv: str | None = None
    encryptedSessionDek: str | None = None
    processingGrant: str | None = None


class IngestionStatusResponse(BaseModel):
    documentId: str
    status: str
    error: str | None = None
