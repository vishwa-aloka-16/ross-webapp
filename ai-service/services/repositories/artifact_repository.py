from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from pathlib import Path

from core.config import BASE_DIR


class ArtifactRepository:
    def __init__(self) -> None:
        self.base_dir = BASE_DIR / ".artifacts"
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, *, document_id: str, run_id: str, artifact_type: str, payload) -> str:
        artifact_dir = self.base_dir / document_id / run_id
        artifact_dir.mkdir(parents=True, exist_ok=True)
        artifact_path = artifact_dir / f"{artifact_type}.json"
        artifact_path.write_text(
            json.dumps({"artifactType": artifact_type, "redacted": True}, indent=2),
            encoding="utf-8",
        )
        return str(artifact_path)

    def load(self, artifact_ref: str):
        return json.loads(Path(artifact_ref).read_text(encoding="utf-8"))

    def _serialize(self, payload):
        if is_dataclass(payload):
            return asdict(payload)
        if isinstance(payload, list):
            return [self._serialize(item) for item in payload]
        if isinstance(payload, dict):
            return {key: self._serialize(value) for key, value in payload.items()}
        return payload
