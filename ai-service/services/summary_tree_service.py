from __future__ import annotations

from db.pgvector import fetch_document_nodes


def _serialize_node(node: dict) -> dict:
    return {
        "id": node["id"],
        "node_type": node["node_type"],
        "level": node["level"],
        "content": node["content"],
        "page_start": node.get("page_start"),
        "page_end": node.get("page_end"),
        "chunk_index": node.get("chunk_index"),
        "cluster_id": node.get("cluster_id"),
        "parent_id": node.get("parent_id"),
        "metadata": node.get("metadata", {}),
        "children": [],
    }


def build_summary_tree(*, owner_id: str, document_id: str) -> dict:
    nodes = fetch_document_nodes(owner_id=owner_id, document_id=document_id)
    if not nodes:
        return {
            "document_id": document_id,
            "root_nodes": [],
            "leaf_count": 0,
            "summary_count": 0,
            "max_level": 0,
        }

    node_map = {node["id"]: _serialize_node(node) for node in nodes}
    referenced_child_ids: set[str] = set()

    for node in nodes:
        if node["node_type"] != "summary":
            continue

        summary_node = node_map[node["id"]]
        child_ids = (node.get("metadata") or {}).get("child_ids", [])
        for child_id in child_ids:
            child_key = str(child_id)
            child_node = node_map.get(child_key)
            if child_node:
                summary_node["children"].append(child_node)
                referenced_child_ids.add(child_key)

    root_nodes = [
        node
        for node in node_map.values()
        if node["node_type"] == "summary" and node["id"] not in referenced_child_ids
    ]
    if not root_nodes:
        root_nodes = [node for node in node_map.values() if node["node_type"] == "leaf"]

    root_nodes.sort(key=lambda node: (-node["level"], node.get("chunk_index") or -1, node["id"]))

    return {
        "document_id": document_id,
        "root_nodes": root_nodes,
        "leaf_count": sum(1 for node in node_map.values() if node["node_type"] == "leaf"),
        "summary_count": sum(1 for node in node_map.values() if node["node_type"] == "summary"),
        "max_level": max(node["level"] for node in node_map.values()),
    }
