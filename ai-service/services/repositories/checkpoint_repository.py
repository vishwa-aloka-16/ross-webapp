from __future__ import annotations

import json
from dataclasses import asdict
from pathlib import Path

from core.config import BASE_DIR
from models.pipeline_checkpoint import PipelineCheckpoint


class CheckpointRepository:
    def __init__(self) -> None:
        self.base_dir = BASE_DIR / ".checkpoints"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, checkpoint: PipelineCheckpoint) -> PipelineCheckpoint:
        path = self._path(checkpoint.document_id, checkpoint.run_id)
        existing = self._read_all(path)
        existing.append(asdict(checkpoint))
        path.write_text(json.dumps(existing, indent=2), encoding="utf-8")
        return checkpoint

    def latest_for_document(self, document_id: str) -> dict | None:
        run_dirs = list((self.base_dir / document_id).glob("*.json")) if (self.base_dir / document_id).exists() else []
        latest = None
        for path in run_dirs:
            records = self._read_all(path)
            if records:
                candidate = records[-1]
                if latest is None or candidate["created_at"] > latest["created_at"]:
                    latest = candidate
        return latest

    def stage_artifact(self, document_id: str, run_id: str, stage: str) -> str | None:
        path = self._path(document_id, run_id)
        for record in reversed(self._read_all(path)):
            if record["stage"] == stage and record["status"] == "completed":
                return record.get("artifact_ref")
        return None

    def _path(self, document_id: str, run_id: str) -> Path:
        document_dir = self.base_dir / document_id
        document_dir.mkdir(parents=True, exist_ok=True)
        return document_dir / f"{run_id}.json"

    def _read_all(self, path: Path) -> list[dict]:
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))
