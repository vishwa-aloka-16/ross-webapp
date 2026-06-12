from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(slots=True)
class TreeNodeRecord:
    id: str
    document_id: str
    owner_id: str
    node_type: str
    content: str
    embedding: list[float] | None
    level: int
    parent_id: str | None
    child_ids: list[str]
    page_start: int | None
    page_end: int | None
    cluster_id: str | None
    layout_strategy: str
    layout_partition: str | None
    metadata: dict[str, Any] = field(default_factory=dict)
