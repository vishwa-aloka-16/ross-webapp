from services.chunkers.transactional_chunker import _artifact_to_legacy_pages
from services.chunkers.base_chunker import BaseChunker
from services.chunking_service import chunk_document
from models.chunk_record import ChunkRecord
from utils.id_generator import generate_id
from utils.token_counter import estimate_tokens


class AdversarialChunker(BaseChunker):
    def chunk(self, *, extraction_artifact, document_profile, owner_id: str) -> list[ChunkRecord]:
        _ = document_profile
        legacy_pages = _artifact_to_legacy_pages(extraction_artifact)
        chunks = chunk_document(legacy_pages, "ADVERSARIAL")
        return [
            ChunkRecord(
                id=generate_id("chunk"),
                document_id=extraction_artifact.document_id,
                owner_id=owner_id,
                content=chunk["content"],
                page_start=chunk.get("page_start"),
                page_end=chunk.get("page_end"),
                chunk_index=chunk["chunk_index"],
                token_count=estimate_tokens(chunk["content"]),
                layout_strategy="ADVERSARIAL",
                layout_partition=chunk.get("metadata", {}).get("layout_partition"),
                metadata={
                    **chunk.get("metadata", {}),
                    "page_start": chunk.get("page_start"),
                    "page_end": chunk.get("page_end"),
                    "chunk_index": chunk["chunk_index"],
                    "token_count": estimate_tokens(chunk["content"]),
                    "extraction_source": "v2",
                    "extraction_confidence": extraction_artifact.quality_report.get("quality", {}).get("confidence", 0.0),
                },
            )
            for chunk in chunks
        ]
