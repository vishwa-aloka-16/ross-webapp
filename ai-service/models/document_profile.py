from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class PageProfile:
    page_number: int
    has_digital_text: bool
    text_density: float
    image_coverage: float
    is_empty: bool
    requires_ocr: bool
    is_table_heavy: bool
    is_complex_layout: bool
    is_mixed: bool
    word_count: int = 0


@dataclass(slots=True)
class DocumentProfile:
    document_id: str
    total_pages: int
    is_scanned: bool
    is_mixed: bool
    has_tables: bool
    has_complex_layout: bool
    ocr_required_pages: list[int] = field(default_factory=list)
    table_heavy_pages: list[int] = field(default_factory=list)
    empty_pages: list[int] = field(default_factory=list)
    average_text_density: float = 0.0
    confidence: float = 0.0
    pages: list[PageProfile] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "total_pages": self.total_pages,
            "is_scanned": self.is_scanned,
            "is_mixed": self.is_mixed,
            "has_tables": self.has_tables,
            "has_complex_layout": self.has_complex_layout,
            "ocr_required_pages": list(self.ocr_required_pages),
            "table_heavy_pages": list(self.table_heavy_pages),
            "empty_pages": list(self.empty_pages),
            "average_text_density": self.average_text_density,
            "confidence": self.confidence,
            "pages": [
                {
                    "page_number": page.page_number,
                    "has_digital_text": page.has_digital_text,
                    "text_density": page.text_density,
                    "image_coverage": page.image_coverage,
                    "is_empty": page.is_empty,
                    "requires_ocr": page.requires_ocr,
                    "is_table_heavy": page.is_table_heavy,
                    "is_complex_layout": page.is_complex_layout,
                    "is_mixed": page.is_mixed,
                    "word_count": page.word_count,
                }
                for page in self.pages
            ],
        }
