from __future__ import annotations

from collections import Counter

from models.document_block import DocumentBlock


class HeaderFooterDetector:
    def remove_repeated_furniture(self, blocks: list[DocumentBlock]) -> list[DocumentBlock]:
        counts = Counter(self._normalized(block.text) for block in blocks if self._is_furniture_candidate(block))
        repeated = {text for text, count in counts.items() if text and count >= 2}
        filtered: list[DocumentBlock] = []
        for block in blocks:
            if self._is_furniture_candidate(block) and self._normalized(block.text) in repeated:
                continue
            filtered.append(block)
        return filtered

    def _is_furniture_candidate(self, block: DocumentBlock) -> bool:
        bbox = block.bbox or {}
        top = float(bbox.get("top", 0))
        bottom = float(bbox.get("bottom", 0))
        return top <= 80 or bottom >= 720 or block.block_type in {"header", "footer", "page_number"}

    def _normalized(self, text: str) -> str:
        return " ".join(text.lower().split())
