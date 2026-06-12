from models.document_block import DocumentBlock


class ExtractionQualityChecker:
    def inspect(self, blocks: list[DocumentBlock], *, warnings: list[str]) -> dict:
        block_count = len(blocks)
        empty_blocks = sum(1 for block in blocks if not block.text.strip())
        source_counts: dict[str, int] = {}
        for block in blocks:
            source_counts[block.source] = source_counts.get(block.source, 0) + 1
        return {
            "block_count": block_count,
            "empty_blocks": empty_blocks,
            "source_counts": source_counts,
            "warning_count": len(warnings),
            "confidence": (
                sum(block.confidence for block in blocks) / block_count if block_count else 0.0
            ),
        }
