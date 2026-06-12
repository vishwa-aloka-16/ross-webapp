class OcrExtractor:
    def extract_page(self, pdf_path: str, page_number: int) -> list[dict]:
        _ = pdf_path
        return [
            {
                "text": "",
                "bbox": None,
                "page_number": page_number,
                "source": "ocr",
                "block_type": "unknown",
                "font_size": None,
                "font_name": None,
                "is_bold": False,
                "confidence": 0.0,
                "reading_order": 0,
                "metadata": {"ocr_required": True, "ocr_configured": False},
            }
        ]
