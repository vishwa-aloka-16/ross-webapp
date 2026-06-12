from services.chunkers.chunk_quality_validator import ChunkQualityValidator
from models.validation_result import ValidationResult
from services.chunkers.transactional_chunker import TransactionalChunker
from services.raptor_builders.raptor_tree_validator import RaptorTreeValidator
from services.raptor_builders.transactional_raptor_builder import TransactionalRaptorBuilder
from services.strategies.base_strategy import BaseStrategy


class TransactionalStrategy(BaseStrategy):
    name = "TRANSACTIONAL"

    def __init__(self) -> None:
        self.chunker = TransactionalChunker()
        self.chunk_validator = ChunkQualityValidator()
        self.raptor_builder = TransactionalRaptorBuilder()
        self.tree_validator = RaptorTreeValidator()

    def chunk(self, extraction_artifact, document_profile, owner_id: str):
        return self.chunker.chunk(
            extraction_artifact=extraction_artifact,
            document_profile=document_profile,
            owner_id=owner_id,
        )

    async def build_tree(self, embedded_chunks, document_profile, document_id: str, owner_id: str):
        return await self.raptor_builder.build_tree(
            document_id=document_id,
            owner_id=owner_id,
            embedded_chunks=embedded_chunks,
            document_profile=document_profile,
        )

    def validate(self, tree_nodes, chunks, document_profile):
        _ = document_profile
        chunk_validation = self.chunk_validator.validate(chunks, layout_strategy=self.name)
        tree_validation = self.tree_validator.validate(_dicts_to_tree_records(tree_nodes), layout_strategy=self.name)
        errors = [*chunk_validation.errors, *tree_validation.errors]
        warnings = [*chunk_validation.warnings, *tree_validation.warnings]
        return ValidationResult(
            passed=not errors,
            errors=errors,
            warnings=warnings,
            stats={**chunk_validation.stats, **tree_validation.stats},
        )


def _dicts_to_tree_records(nodes):
    from models.tree_node_record import TreeNodeRecord

    records = []
    for node in nodes:
        metadata = node.get("metadata") or {}
        records.append(
            TreeNodeRecord(
                id=node["id"],
                document_id=node["document_id"],
                owner_id=node["owner_id"],
                node_type=node["node_type"],
                content=node["content"],
                embedding=node.get("embedding"),
                level=node["level"],
                parent_id=node.get("parent_id"),
                child_ids=metadata.get("child_ids", []),
                page_start=node.get("page_start"),
                page_end=node.get("page_end"),
                cluster_id=node.get("cluster_id"),
                layout_strategy=metadata.get("layout_strategy", "TRANSACTIONAL"),
                layout_partition=metadata.get("layout_partition"),
                metadata=metadata,
            )
        )
    return records
