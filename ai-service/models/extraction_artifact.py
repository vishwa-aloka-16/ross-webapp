from __future__ import annotations

from dataclasses import dataclass, field

from models.document_block import DocumentBlock


@dataclass(slots=True)
class ExtractionArtifact:
    document_id: str
    profile: dict
    blocks: list[DocumentBlock]
    quality_report: dict
    warnings: list[str] = field(default_factory=list)
