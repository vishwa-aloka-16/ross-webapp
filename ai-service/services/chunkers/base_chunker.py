from __future__ import annotations

from abc import ABC, abstractmethod

from models.chunk_record import ChunkRecord
from models.document_profile import DocumentProfile
from models.extraction_artifact import ExtractionArtifact


class BaseChunker(ABC):
    @abstractmethod
    def chunk(
        self,
        *,
        extraction_artifact: ExtractionArtifact,
        document_profile: DocumentProfile,
        owner_id: str,
    ) -> list[ChunkRecord]:
        raise NotImplementedError
