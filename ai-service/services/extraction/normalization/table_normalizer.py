from models.document_block import DocumentBlock


class TableNormalizer:
    def normalize(self, blocks: list[DocumentBlock]) -> list[DocumentBlock]:
        for index, block in enumerate(blocks):
            if block.block_type != "table":
                continue
            block.table_id = block.table_id or f"table-{block.page_number}-{index}"
            block.metadata.setdefault("table_id", block.table_id)
        return blocks
