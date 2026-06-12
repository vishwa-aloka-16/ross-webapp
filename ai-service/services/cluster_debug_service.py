from db.pgvector import fetch_document_leaf_nodes_with_embeddings
from services.clustering_service import cluster_adversarially, cluster_globally
from services.cluster_planning_service import (
    MIN_SUMMARY_WORDS,
    TINY_GROUP_WORDS,
    build_cluster_plan,
    resolve_target_cluster_count,
)
from services.chunking_service import normalize_layout_strategy


def build_cluster_preview(
    *,
    owner_id: str,
    document_id: str,
    layout_strategy: str | None,
    target_clusters: int | None = None,
) -> dict:
    leaf_nodes = fetch_document_leaf_nodes_with_embeddings(owner_id=owner_id, document_id=document_id)
    if not leaf_nodes:
        return _empty_preview(document_id=document_id, layout_strategy=layout_strategy)

    embeddings = [node.get("embedding") for node in leaf_nodes]
    if any(not embedding for embedding in embeddings):
        raise RuntimeError("Cluster preview requires leaf embeddings. Re-index this document and try again.")

    strategy = normalize_layout_strategy(layout_strategy)
    target = resolve_target_cluster_count(len(leaf_nodes), target_clusters)
    cluster_fn = cluster_adversarially if strategy == "ADVERSARIAL" else cluster_globally
    plan = build_cluster_plan(
        current_nodes=leaf_nodes,
        current_embeddings=embeddings,
        target_clusters=target,
        level=1,
        cluster_fn=cluster_fn,
    )
    clusters = plan["raw_diagnostics"]
    return {
        "documentId": document_id,
        "layoutStrategy": strategy,
        "leafCount": len(leaf_nodes),
        "clusterCount": len(clusters),
        "tinyClusterCount": sum(1 for cluster in clusters if cluster["isTiny"]),
        "minSummaryWords": MIN_SUMMARY_WORDS,
        "tinyGroupWords": TINY_GROUP_WORDS,
        "targetClusters": target,
        "clusters": clusters,
    }


def _empty_preview(*, document_id: str, layout_strategy: str | None) -> dict:
    return {
        "documentId": document_id,
        "layoutStrategy": normalize_layout_strategy(layout_strategy),
        "leafCount": 0,
        "clusterCount": 0,
        "tinyClusterCount": 0,
        "minSummaryWords": MIN_SUMMARY_WORDS,
        "tinyGroupWords": TINY_GROUP_WORDS,
        "targetClusters": 0,
        "clusters": [],
    }
