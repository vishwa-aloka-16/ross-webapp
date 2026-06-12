from __future__ import annotations

import tempfile
from pathlib import Path


class TempFileService:
    def write_pdf(self, pdf_bytes: bytes, *, suffix: str = ".pdf") -> str:
        temp_dir = Path(tempfile.gettempdir()) / "lawai"
        temp_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=temp_dir) as handle:
            handle.write(pdf_bytes)
            return handle.name
