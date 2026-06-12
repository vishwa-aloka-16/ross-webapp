import asyncio
import unittest
from unittest.mock import AsyncMock, patch

from models.document_block import DocumentBlock
from models.document_profile import PageProfile
from services.chunkers.chunk_quality_validator import ChunkQualityValidator
from services.extraction.extraction_router import ExtractionRouter
from services.extraction.normalization.header_footer_detector import HeaderFooterDetector
from services.ingestion_service import process_document
from services.strategies.strategy_router import StrategyRouter


class ExtractionRouterTests(unittest.TestCase):
    def setUp(self):
        self.router = ExtractionRouter()

    def test_routes_ocr_pages_first(self):
        profile = PageProfile(
            page_number=1,
            has_digital_text=False,
            text_density=0.0,
            image_coverage=0.8,
            is_empty=False,
            requires_ocr=True,
            is_table_heavy=True,
            is_complex_layout=True,
            is_mixed=False,
            word_count=0,
        )
        self.assertEqual(self.router.choose_method(profile), "OCR")

    def test_routes_table_pages_to_pdfplumber(self):
        profile = PageProfile(
            page_number=2,
            has_digital_text=True,
            text_density=0.6,
            image_coverage=0.0,
            is_empty=False,
            requires_ocr=False,
            is_table_heavy=True,
            is_complex_layout=False,
            is_mixed=False,
            word_count=180,
        )
        self.assertEqual(self.router.choose_method(profile), "PDFPLUMBER_TABLE_AWARE")


class V2NormalizationTests(unittest.TestCase):
    def test_header_footer_detector_removes_repeated_furniture(self):
        detector = HeaderFooterDetector()
        blocks = [
            DocumentBlock("doc", 1, "a", "paragraph", "Confidential Draft", {"top": 10, "bottom": 30}, 0),
            DocumentBlock("doc", 1, "b", "paragraph", "Body One", {"top": 120, "bottom": 160}, 1),
            DocumentBlock("doc", 2, "c", "paragraph", "Confidential Draft", {"top": 10, "bottom": 30}, 2),
            DocumentBlock("doc", 2, "d", "paragraph", "Body Two", {"top": 120, "bottom": 160}, 3),
        ]

        filtered = detector.remove_repeated_furniture(blocks)

        self.assertEqual([block.text for block in filtered], ["Body One", "Body Two"])


class StrategyContractTests(unittest.TestCase):
    def test_strategy_router_keeps_stable_names(self):
        router = StrategyRouter()
        self.assertEqual(router.get_strategy("TRANSACTIONAL").name, "TRANSACTIONAL")
        self.assertEqual(router.get_strategy("ADVERSARIAL").name, "ADVERSARIAL")
        self.assertEqual(router.get_strategy("HIERARCHICAL").name, "HIERARCHICAL")

    def test_chunk_validator_rejects_empty_output(self):
        validator = ChunkQualityValidator()
        result = validator.validate([], layout_strategy="TRANSACTIONAL")
        self.assertFalse(result.passed)
        self.assertIn("No chunks were produced.", result.errors)


class IngestionDelegationTests(unittest.TestCase):
    def test_process_document_delegates_to_orchestrator(self):
        payload = {
            "documentId": "doc-1",
            "ownerId": "owner-1",
            "fileName": "demo.pdf",
            "storagePath": "docs/demo.pdf",
            "layoutStrategy": "TRANSACTIONAL",
        }

        with patch("services.ingestion_service.IngestionOrchestrator") as orchestrator_cls:
            orchestrator = orchestrator_cls.return_value
            orchestrator.run = AsyncMock(return_value={"status": "indexed", "documentId": "doc-1"})

            result = asyncio.run(process_document(payload))

        self.assertEqual(result["status"], "indexed")
        orchestrator.run.assert_awaited_once()


if __name__ == "__main__":
    unittest.main()
