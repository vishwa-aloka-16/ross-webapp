from __future__ import annotations

import services.pdf_extraction_service as legacy_pdf
from models.document_block import DocumentBlock


class HeadingDetector:
    def detect_headings(self, blocks: list[DocumentBlock]) -> list[DocumentBlock]:
        body_font = self._body_font_size(blocks)
        for block in blocks:
            if block.block_type == "table" or not block.text:
                continue
            level = legacy_pdf._detect_heading_level(
                {
                    "text": block.text,
                    "font_size": block.font_size,
                    "bold": block.is_bold,
                    "gap_before": block.metadata.get("gap_before", 0),
                },
                body_font,
            )
            if level is not None:
                block.block_type = "heading"
                block.section_level = level
                block.section_candidate = True
        return blocks

    def _body_font_size(self, blocks: list[DocumentBlock]) -> float | None:
        font_sizes = [block.font_size for block in blocks if block.font_size]
        if not font_sizes:
            return None
        font_sizes.sort()
        return font_sizes[len(font_sizes) // 2]
