from __future__ import annotations

from models.document_block import DocumentBlock
from utils.id_generator import generate_id


class BlockNormalizer:
    def normalize(self, raw_blocks: list[dict], *, document_id: str, page_number: int) -> list[DocumentBlock]:
        blocks: list[DocumentBlock] = []
        for index, block in enumerate(raw_blocks):
            text = (block.get("text") or "").strip()
            if not text and block.get("block_type") != "unknown":
                continue
            block_type = block.get("block_type") or "paragraph"
            metadata = dict(block.get("metadata") or {})
            blocks.append(
                DocumentBlock(
                    document_id=document_id,
                    page_number=page_number,
                    block_id=generate_id("block"),
                    block_type=block_type,
                    text=text,
                    bbox=block.get("bbox"),
                    reading_order=int(block.get("reading_order", index)),
                    font_size=block.get("font_size"),
                    font_name=block.get("font_name"),
                    is_bold=bool(block.get("is_bold", False)),
                    is_italic=bool(block.get("is_italic", False)),
                    section_level=block.get("section_level"),
                    section_candidate=bool(block.get("section_candidate", False)),
                    list_item=block_type == "list_item",
                    table_id=metadata.get("table_id"),
                    source=block.get("source", "unknown"),
                    confidence=float(block.get("confidence", 1.0)),
                    metadata=metadata,
                )
            )
        return blocks
