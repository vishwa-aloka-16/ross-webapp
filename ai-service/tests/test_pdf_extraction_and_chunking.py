import unittest

from services import chunking_service
from services import pdf_extraction_service


class PdfExtractionHeuristicTests(unittest.TestCase):
    def test_repairs_hyphenated_line_breaks(self):
        self.assertEqual(
            pdf_extraction_service.normalize_extracted_text("The agree-\nment applies."),
            "The agreement applies.",
        )

    def test_detects_numbered_heading_level(self):
        line = {
            "text": "4.2 Data Governance Allocation",
            "font_size": 12,
            "bold": True,
            "gap_before": 12,
        }

        self.assertEqual(pdf_extraction_service._detect_heading_level(line, 10), 2)

    def test_rejects_sentence_that_looks_numeric(self):
        line = {
            "text": "3.14 apples are sweet.",
            "font_size": 10,
            "bold": False,
            "gap_before": 2,
        }

        self.assertIsNone(pdf_extraction_service._detect_heading_level(line, 10))

    def test_detects_repeated_headers_and_footers(self):
        payloads = [
            {
                "height": 100,
                "lines": [
                    {"text": "Confidential Draft", "top": 2, "bottom": 8},
                    {"text": "1", "top": 94, "bottom": 98},
                ],
            },
            {
                "height": 100,
                "lines": [
                    {"text": "Confidential Draft", "top": 2, "bottom": 8},
                    {"text": "2", "top": 94, "bottom": 98},
                ],
            },
        ]

        keys = pdf_extraction_service._detect_repeated_furniture(payloads)

        self.assertIn("confidential draft", keys)

    def test_renders_table_cells(self):
        rows = [["Clause", "Risk"], ["4.1", "High"]]

        self.assertEqual(
            pdf_extraction_service._render_table_rows(rows),
            "Clause | Risk\n4.1 | High",
        )
        self.assertEqual(len(pdf_extraction_service._table_cells_from_rows(rows)), 4)


class ChunkingCompatibilityTests(unittest.TestCase):
    def test_hierarchical_chunking_uses_structured_headings(self):
        pages = [
            {
                "page_number": 1,
                "text": "Section 1 Introduction\nThis agreement applies.",
                "items": [
                    {
                        "label": "SECTION_HEADER",
                        "text": "Section 1 Introduction",
                        "page_number": 1,
                        "reading_order": 0,
                        "section_level": 1,
                    },
                    {
                        "label": "PARAGRAPH",
                        "text": "This agreement applies.",
                        "page_number": 1,
                        "reading_order": 1,
                    },
                ],
            }
        ]

        chunks = chunking_service.chunk_document(pages, "HIERARCHICAL")

        self.assertEqual(chunks[0]["metadata"]["section_key"], "section-1")
        self.assertEqual(chunks[0]["metadata"]["structural_depth"], 1)

    def test_transactional_overlap_keeps_true_page_range(self):
        pages = [
            {"page_number": 1, "text": "one two three four five"},
            {"page_number": 2, "text": "six seven eight nine ten"},
        ]

        chunks = chunking_service.chunk_pages(pages, target_words=6, overlap_words=2)

        self.assertEqual(chunks[1]["page_start"], 1)
        self.assertEqual(chunks[1]["page_end"], 2)

    def test_adversarial_neutral_paragraphs_do_not_inherit_party(self):
        pages = [
            {
                "page_number": 1,
                "text": "The Claimant says breach occurred.\n\nThe background facts are undisputed.",
                "items": [
                    {
                        "label": "PARAGRAPH",
                        "text": "The Claimant says breach occurred.",
                        "page_number": 1,
                        "reading_order": 0,
                    },
                    {
                        "label": "PARAGRAPH",
                        "text": "The background facts are undisputed.",
                        "page_number": 1,
                        "reading_order": 1,
                    },
                ],
            }
        ]

        chunks = chunking_service.chunk_document(pages, "ADVERSARIAL")

        self.assertEqual(chunks[0]["metadata"]["party_enclave"], "CLAIMANT")
        self.assertEqual(chunks[1]["metadata"]["party_enclave"], "NEUTRAL")


if __name__ == "__main__":
    unittest.main()
