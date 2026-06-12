from __future__ import annotations

import services.pdf_extraction_service as legacy_pdf
from models.document_block import DocumentBlock


class ListItemDetector:
    def detect_lists(self, blocks: list[DocumentBlock]) -> list[DocumentBlock]:
        for block in blocks:
            if legacy_pdf._looks_like_list_item(block.text):
                block.block_type = "list_item"
                block.list_item = True
        return blocks
