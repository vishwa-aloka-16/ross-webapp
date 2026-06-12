from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(slots=True)
class PipelineCheckpoint:
    checkpoint_id: str
    document_id: str
    owner_id: str
    run_id: str
    stage: str
    status: str
    artifact_ref: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    error_message: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
