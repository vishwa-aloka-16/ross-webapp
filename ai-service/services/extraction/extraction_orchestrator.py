from __future__ import annotations

import logging
from pathlib import Path

from models.extraction_artifact import ExtractionArtifact
from services.extraction.engines.ocr_extractor import OcrExtractor
from services.extraction.engines.pdfplumber_extractor import PdfPlumberExtractor
from services.extraction.engines.pymupdf_extractor import PyMuPdfExtractor
from services.extraction.extraction_router import ExtractionRouter
from services.extraction.normalization.block_normalizer import BlockNormalizer
from services.extraction.normalization.header_footer_detector import HeaderFooterDetector
from services.extraction.normalization.heading_detector import HeadingDetector
from services.extraction.normalization.list_item_detector import ListItemDetector
from services.extraction.normalization.reading_order_resolver import ReadingOrderResolver
from services.extraction.normalization.table_normalizer import TableNormalizer
from services.extraction.pdf_profiler import PdfProfiler
from services.extraction.quality.extraction_quality_checker import ExtractionQualityChecker
from services.extraction.quality.extraction_report_builder import ExtractionReportBuilder
from services.pdf_extraction_service import extract_pdf_structure

logger = logging.getLogger(__name__)


class ExtractionOrchestrator:
    def __init__(self) -> None:
        self.pdf_profiler = PdfProfiler()
        self.extraction_router = ExtractionRouter()
        self.pymupdf_extractor = PyMuPdfExtractor()
        self.pdfplumber_extractor = PdfPlumberExtractor()
        self.ocr_extractor = OcrExtractor()
        self.block_normalizer = BlockNormalizer()
        self.header_footer_detector = HeaderFooterDetector()
        self.reading_order_resolver = ReadingOrderResolver()
        self.heading_detector = HeadingDetector()
        self.list_item_detector = ListItemDetector()
        self.table_normalizer = TableNormalizer()
        self.quality_checker = ExtractionQualityChecker()
        self.report_builder = ExtractionReportBuilder()

    def extract_document_v2(self, pdf_path: str, document_id: str) -> ExtractionArtifact:
        profile = self.pdf_profiler.profile_pdf(pdf_path, document_id)
        blocks = []
        warnings: list[str] = []
        used_legacy_fallback = False

        try:
            for page_profile in profile.pages:
                method = self.extraction_router.choose_method(page_profile)
                logger.info(
                    "extraction_page_route document_id=%s page=%s method=%s",
                    document_id,
                    page_profile.page_number,
                    method,
                )
                if method == "OCR":
                    raw_blocks = self.ocr_extractor.extract_page(pdf_path, page_profile.page_number)
                    warnings.append(f"OCR required for page {page_profile.page_number} but no OCR engine is configured.")
                elif method == "PDFPLUMBER_TABLE_AWARE":
                    raw_blocks = self.pdfplumber_extractor.extract_page_with_tables(pdf_path, page_profile.page_number)
                elif method == "HYBRID":
                    raw_blocks = self.pymupdf_extractor.extract_page_blocks(pdf_path, page_profile.page_number)
                    if not raw_blocks:
                        raw_blocks = self.pdfplumber_extractor.extract_page_with_tables(pdf_path, page_profile.page_number)
                else:
                    raw_blocks = self.pymupdf_extractor.extract_page_blocks(pdf_path, page_profile.page_number)
                    if not raw_blocks:
                        raw_blocks = self.pdfplumber_extractor.extract_page_with_tables(pdf_path, page_profile.page_number)

                blocks.extend(
                    self.block_normalizer.normalize(
                        raw_blocks,
                        document_id=document_id,
                        page_number=page_profile.page_number,
                    )
                )
        except Exception:  # noqa: BLE001
            logger.exception("v2_extraction_failed document_id=%s using_legacy_fallback=true", document_id)
            used_legacy_fallback = True
            legacy_pages = extract_pdf_structure(Path(pdf_path).read_bytes())
            for page in legacy_pages:
                raw_blocks = []
                for item in page.get("items", []):
                    raw_blocks.append(
                        {
                            "text": item.get("text", ""),
                            "bbox": item.get("bbox"),
                            "page_number": page["page_number"],
                            "source": "legacy_pdfplumber",
                            "block_type": _legacy_label_to_block_type(item.get("label")),
                            "font_size": None,
                            "font_name": None,
                            "is_bold": False,
                            "confidence": 0.85,
                            "reading_order": item.get("reading_order", 0),
                            "section_level": item.get("section_level"),
                            "metadata": {"table_cells": item.get("table_cells", [])},
                        }
                    )
                blocks.extend(
                    self.block_normalizer.normalize(
                        raw_blocks,
                        document_id=document_id,
                        page_number=page["page_number"],
                    )
                )
            warnings.append("Fell back to legacy PDF extractor.")

        blocks = self.header_footer_detector.remove_repeated_furniture(blocks)
        blocks = self.reading_order_resolver.resolve(blocks)
        blocks = self.heading_detector.detect_headings(blocks)
        blocks = self.list_item_detector.detect_lists(blocks)
        blocks = self.table_normalizer.normalize(blocks)

        quality = self.quality_checker.inspect(blocks, warnings=warnings)
        return ExtractionArtifact(
            document_id=document_id,
            profile=profile.to_dict(),
            blocks=blocks,
            quality_report=self.report_builder.build(
                profile=profile.to_dict(),
                quality=quality,
                warnings=warnings,
                used_legacy_fallback=used_legacy_fallback,
            ),
            warnings=warnings,
        )


def _legacy_label_to_block_type(label: str | None) -> str:
    mapping = {
        "SECTION_HEADER": "heading",
        "PARAGRAPH": "paragraph",
        "LIST_ITEM": "list_item",
        "TABLE": "table",
        "PAGE_HEADER": "header",
        "PAGE_FOOTER": "footer",
    }
    return mapping.get(label or "", "unknown")


def extract_document_v2(pdf_path: str, document_id: str) -> ExtractionArtifact:
    return ExtractionOrchestrator().extract_document_v2(pdf_path, document_id)
