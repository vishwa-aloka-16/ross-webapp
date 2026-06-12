from __future__ import annotations

from io import BytesIO

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None

from models.document_profile import DocumentProfile, PageProfile


class PdfProfiler:
    def profile_pdf(self, pdf_path: str, document_id: str) -> DocumentProfile:
        if pdfplumber is None:
            raise RuntimeError("pdfplumber is not installed. Add `pdfplumber` before ingesting PDFs.")

        pages: list[PageProfile] = []
        with pdfplumber.open(pdf_path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                words = page.extract_words() or []
                chars = page.chars or []
                images = page.images or []
                text_density = min(1.0, len(words) / 350) if words else 0.0
                image_coverage = min(1.0, len(images) / 8) if images else 0.0
                has_digital_text = bool(chars)
                is_empty = not words and not images
                try:
                    table_count = len(page.find_tables())
                except Exception:  # noqa: BLE001
                    table_count = 0
                is_table_heavy = table_count > 0
                is_complex_layout = len({round(float(word.get("x0", 0)) / 40) for word in words}) >= 3 if words else False
                requires_ocr = not has_digital_text and not is_empty
                is_mixed = has_digital_text and image_coverage >= 0.2

                pages.append(
                    PageProfile(
                        page_number=index,
                        has_digital_text=has_digital_text,
                        text_density=text_density,
                        image_coverage=image_coverage,
                        is_empty=is_empty,
                        requires_ocr=requires_ocr,
                        is_table_heavy=is_table_heavy,
                        is_complex_layout=is_complex_layout,
                        is_mixed=is_mixed,
                        word_count=len(words),
                    )
                )

        return DocumentProfile(
            document_id=document_id,
            total_pages=len(pages),
            is_scanned=bool(pages) and all(page.requires_ocr or page.is_empty for page in pages),
            is_mixed=any(page.is_mixed for page in pages),
            has_tables=any(page.is_table_heavy for page in pages),
            has_complex_layout=any(page.is_complex_layout for page in pages),
            ocr_required_pages=[page.page_number for page in pages if page.requires_ocr],
            table_heavy_pages=[page.page_number for page in pages if page.is_table_heavy],
            empty_pages=[page.page_number for page in pages if page.is_empty],
            average_text_density=(sum(page.text_density for page in pages) / len(pages)) if pages else 0.0,
            confidence=0.9 if pages else 0.0,
            pages=pages,
        )
