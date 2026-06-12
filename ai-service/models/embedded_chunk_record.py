from __future__ import annotations

from dataclasses import dataclass

from models.chunk_record import ChunkRecord


@dataclass(slots=True)
class EmbeddedChunkRecord(ChunkRecord):
    embedding: list[float] | None = None
