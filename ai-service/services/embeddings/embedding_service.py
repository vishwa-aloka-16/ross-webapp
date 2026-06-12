from __future__ import annotations

from dataclasses import asdict

from models.embedded_chunk_record import EmbeddedChunkRecord
from services.embedding_service import batch_embed_texts


class EmbeddingService:
    async def embed_chunks(self, chunks):
        embeddings = await batch_embed_texts(
            [chunk.content for chunk in chunks],
            task_type="RETRIEVAL_DOCUMENT",
        )
        records: list[EmbeddedChunkRecord] = []
        for chunk, embedding in zip(chunks, embeddings, strict=True):
            records.append(
                EmbeddedChunkRecord(
                    **asdict(chunk),
                    embedding=embedding,
                )
            )
        return records
