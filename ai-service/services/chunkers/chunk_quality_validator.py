from models.chunk_record import ChunkRecord
from models.validation_result import ValidationResult


class ChunkQualityValidator:
    def validate(self, chunks: list[ChunkRecord], *, layout_strategy: str) -> ValidationResult:
        errors: list[str] = []
        if not chunks:
            errors.append("No chunks were produced.")
        for chunk in chunks:
            if not chunk.content.strip():
                errors.append(f"Chunk {chunk.id} is empty.")
            if chunk.metadata.get("layout_strategy") != layout_strategy:
                errors.append(f"Chunk {chunk.id} has mismatched layout_strategy.")
        return ValidationResult(
            passed=not errors,
            errors=errors,
            warnings=[],
            stats={"chunk_count": len(chunks)},
        )
