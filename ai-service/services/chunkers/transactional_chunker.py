from __future__ import annotations

from models.chunk_record import ChunkRecord
from services.chunkers.base_chunker import BaseChunker
from services.chunking_service import chunk_document
from utils.id_generator import generate_id
from utils.token_counter import estimate_tokens


class TransactionalChunker(BaseChunker):
    def chunk(self, *, extraction_artifact, document_profile, owner_id: str) -> list[ChunkRecord]:
        _ = document_profile
        legacy_pages = _artifact_to_legacy_pages(extraction_artifact)
        chunks = chunk_document(legacy_pages, "TRANSACTIONAL")
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
                layout_strategy="TRANSACTIONAL",
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


def _artifact_to_legacy_pages(extraction_artifact) -> list[dict]:
    pages: dict[int, list] = {}
    for block in extraction_artifact.blocks:
        pages.setdefault(block.page_number, []).append(block)

    payloads = []
    for page_number, blocks in sorted(pages.items()):
        blocks.sort(key=lambda block: block.reading_order)
        payloads.append(
            {
                "page_number": page_number,
                "text": "\n\n".join(block.text for block in blocks if block.block_type in {"paragraph", "heading", "list_item", "table"} and block.text),
                "items": [
                    {
                        "label": _block_type_to_label(block.block_type),
                        "text": block.text,
                        "page_number": block.page_number,
                        "reading_order": block.reading_order,
                        "section_level": block.section_level,
                        "bbox": block.bbox,
                    }
                    for block in blocks
                ],
            }
        )
    return payloads


def _block_type_to_label(block_type: str) -> str:
    return {
        "heading": "SECTION_HEADER",
        "paragraph": "PARAGRAPH",
        "list_item": "LIST_ITEM",
        "table": "TABLE",
    }.get(block_type, "TEXT")
