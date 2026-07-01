from __future__ import annotations

import hashlib
import json
from pathlib import Path
from threading import Lock
from typing import Any


BASE_DIR = Path(__file__).resolve().parents[1]
CACHE_DIR = BASE_DIR / "data" / "gemini_cache"

_cache_lock = Lock()


def _cache_path(namespace: str, payload: dict[str, Any]) -> Path:
    serialized = json.dumps(payload, sort_keys=True, ensure_ascii=True)
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    return CACHE_DIR / namespace / f"{digest}.json"


def load_cached(namespace: str, payload: dict[str, Any]) -> Any | None:
    return None


def save_cached(namespace: str, payload: dict[str, Any], value: Any) -> None:
    return None
