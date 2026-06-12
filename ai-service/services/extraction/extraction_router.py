class ExtractionRouter:
    def choose_method(self, page_profile) -> str:
        if page_profile.requires_ocr:
            return "OCR"
        if page_profile.is_table_heavy:
            return "PDFPLUMBER_TABLE_AWARE"
        if page_profile.is_complex_layout or page_profile.is_mixed:
            return "HYBRID"
        return "PYMUPDF_BLOCKS"
