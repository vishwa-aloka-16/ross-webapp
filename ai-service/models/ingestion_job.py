from __future__ import annotations

from dataclasses import dataclass

from services.chunking_service import normalize_layout_strategy


@dataclass(slots=True)
class IngestionJob:
    document_id: str
    owner_id: str
    file_name: str
    storage_path: str
    layout_strategy: str
    file_iv: str | None = None
    encrypted_session_dek: str | None = None

    @classmethod
    def from_payload(cls, payload: dict) -> "IngestionJob":
        return cls(
            document_id=payload["documentId"],
            owner_id=payload["ownerId"],
            file_name=payload["fileName"],
            storage_path=payload["storagePath"],
            layout_strategy=normalize_layout_strategy(payload.get("layoutStrategy")),
            file_iv=payload.get("fileIv"),
            encrypted_session_dek=payload.get("encryptedSessionDek"),
        )
