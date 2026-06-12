from __future__ import annotations

from io import BytesIO

import services.pdf_extraction_service as legacy_pdf

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None


class PdfPlumberExtractor:
    def extract_page_with_tables(self, pdf_path: str, page_number: int) -> list[dict]:
        if pdfplumber is None:
            raise RuntimeError("pdfplumber is not installed. Add `pdfplumber` before ingesting PDFs.")

        with pdfplumber.open(pdf_path) as pdf:
            page = pdf.pages[page_number - 1]
            payload = legacy_pdf._extract_raw_page(page, page_number)

        blocks: list[dict] = []
        for index, line in enumerate(payload["lines"]):
            blocks.append(
                {
                    "text": line["text"],
                    "bbox": line["bbox"],
                    "page_number": page_number,
                    "source": "pdfplumber",
                    "block_type": "paragraph",
                    "font_size": line.get("font_size"),
                    "font_name": None,
                    "is_bold": line.get("bold", False),
                    "confidence": 0.96,
                    "reading_order": index,
                    "metadata": {},
                }
            )

        base_index = len(blocks)
        for table in payload["tables"]:
            blocks.append(
                {
                    "text": table["text"],
                    "bbox": table["bbox"],
                    "page_number": page_number,
                    "source": "pdfplumber",
                    "block_type": "table",
                    "font_size": None,
                    "font_name": None,
                    "is_bold": False,
                    "confidence": 0.94,
                    "reading_order": base_index,
                    "metadata": {
                        "table_cells": table.get("table_cells", []),
                        "table_index": table.get("table_index"),
                    },
                }
            )
            base_index += 1

        return blocks
