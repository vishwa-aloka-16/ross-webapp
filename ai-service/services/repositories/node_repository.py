from __future__ import annotations

from db.pgvector import delete_document_nodes, insert_nodes


class NodeRepository:
    def replace_document_nodes(self, *, document_id: str, nodes: list[dict]) -> None:
        delete_document_nodes(document_id)
        insert_nodes(nodes)
