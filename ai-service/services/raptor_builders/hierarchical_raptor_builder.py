from __future__ import annotations

from uuid import uuid4

from services.raptor_builders.base_raptor_builder import BaseRaptorBuilder
from services.raptor_service import build_structural_summary_nodes


class HierarchicalRaptorBuilder(BaseRaptorBuilder):
    async def build_tree(self, *, document_id: str, owner_id: str, embedded_chunks, document_profile):
        _ = document_profile
        leaf_nodes = [
            {
                "id": str(uuid4()),
                "document_id": document_id,
                "owner_id": owner_id,
                "node_type": "leaf",
                "level": 0,
                "parent_id": None,
                "content": chunk.content,
                "embedding": chunk.embedding,
                "page_start": chunk.page_start,
                "page_end": chunk.page_end,
                "chunk_index": chunk.chunk_index,
                "cluster_id": None,
                "metadata": chunk.metadata,
            }
            for chunk in embedded_chunks
        ]
        summaries = await build_structural_summary_nodes(
            document_id=document_id,
            owner_id=owner_id,
            leaf_nodes=leaf_nodes,
            embed_fn=lambda texts: __import__(
                "services.embedding_service",
                fromlist=["batch_embed_texts"],
            ).batch_embed_texts(texts, task_type="RETRIEVAL_DOCUMENT"),
        )
        return leaf_nodes + summaries
