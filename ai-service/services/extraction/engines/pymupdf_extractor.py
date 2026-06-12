from __future__ import annotations

from io import BytesIO

try:
    import fitz
except ImportError:  # pragma: no cover
    fitz = None


class PyMuPdfExtractor:
    def extract_page_blocks(self, pdf_path: str, page_number: int) -> list[dict]:
        if fitz is None:
            return []

        document = fitz.open(pdf_path)
        try:
            page = document.load_page(page_number - 1)
            payload = page.get_text("dict")
        finally:
            document.close()

        blocks: list[dict] = []
        for block_index, block in enumerate(payload.get("blocks", [])):
            lines = block.get("lines") or []
            texts: list[str] = []
            font_size = None
            font_name = None
            is_bold = False
            for line in lines:
                spans = line.get("spans") or []
                texts.append(" ".join((span.get("text") or "").strip() for span in spans if span.get("text")))
                if spans and font_size is None:
                    font_size = float(spans[0].get("size", 0)) or None
                    font_name = spans[0].get("font")
                    is_bold = "bold" in str(font_name or "").lower()
            text = " ".join(part.strip() for part in texts if part.strip()).strip()
            if not text:
                continue
            x0, y0, x1, y1 = block.get("bbox", (0, 0, 0, 0))
            blocks.append(
                {
                    "text": text,
                    "bbox": {"left": x0, "top": y0, "right": x1, "bottom": y1},
                    "page_number": page_number,
                    "source": "pymupdf",
                    "block_type": "paragraph",
                    "font_size": font_size,
                    "font_name": font_name,
                    "is_bold": is_bold,
                    "confidence": 0.98,
                    "reading_order": block_index,
                    "metadata": {},
                }
            )
        return blocks
