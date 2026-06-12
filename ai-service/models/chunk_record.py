from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class ChunkRecord:
    id: str
    document_id: str
    owner_id: str
    content: str
    page_start: int | None
    page_end: int | None
    chunk_index: int
    token_count: int
    layout_strategy: str
    layout_partition: str | None
    metadata: dict[str, Any] = field(default_factory=dict)
