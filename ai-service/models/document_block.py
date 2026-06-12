from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class DocumentBlock:
    document_id: str
    page_number: int
    block_id: str
    block_type: str
    text: str
    bbox: dict[str, float] | None = None
    reading_order: int = 0
    font_size: float | None = None
    font_name: str | None = None
    is_bold: bool = False
    is_italic: bool = False
    section_level: int | None = None
    section_candidate: bool = False
    list_item: bool = False
    table_id: str | None = None
    source: str = "unknown"
    confidence: float = 1.0
    metadata: dict[str, Any] = field(default_factory=dict)
