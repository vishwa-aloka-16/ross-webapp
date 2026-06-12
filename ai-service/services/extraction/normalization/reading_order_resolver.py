from models.document_block import DocumentBlock


class ReadingOrderResolver:
    def resolve(self, blocks: list[DocumentBlock]) -> list[DocumentBlock]:
        ordered = sorted(
            blocks,
            key=lambda block: (
                block.page_number,
                float((block.bbox or {}).get("top", 0)),
                float((block.bbox or {}).get("left", 0)),
                block.reading_order,
            ),
        )
        for index, block in enumerate(ordered):
            block.reading_order = index
        return ordered
