from models.chunk_record import ChunkRecord


class EmbeddingBatcher:
    def batch(self, chunks: list[ChunkRecord]) -> list[str]:
        return [chunk.content for chunk in chunks]
