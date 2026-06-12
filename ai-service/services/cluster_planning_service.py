from __future__ import annotations

import math


MIN_SUMMARY_WORDS = 100
TINY_GROUP_WORDS = 200
SNIPPET_CHARS = 220


def resolve_target_cluster_count(leaf_count: int, target_clusters: int | None) -> int:
    if leaf_count <= 1:
        return leaf_count
    if target_clusters is not None:
        return max(1, min(int(target_clusters), leaf_count))
    return max(2, min(5, math.ceil(math.sqrt(leaf_count / 2))))


def build_cluster_plan(
    *,
    current_nodes: list[dict],
    current_embeddings: list[list[float]],
    target_clusters: int,
    level: int,
    cluster_fn,
) -> dict:
    raw_clusters = cluster_fn(current_nodes, current_embeddings, target_clusters, level)
    raw_diagnostics = build_cluster_diagnostics(leaf_nodes=current_nodes, raw_clusters=raw_clusters)
    merge_targets = _assign_merge_targets(raw_diagnostics)

    for cluster in raw_diagnostics:
        cluster["mergeTargetClusterId"] = merge_targets.get(cluster["clusterId"])

    normalized_clusters = _merge_tiny_clusters(raw_clusters=raw_clusters, diagnostics=raw_diagnostics)
    normalized_diagnostics = build_cluster_diagnostics(
        leaf_nodes=current_nodes,
        raw_clusters=normalized_clusters,
    )

    return {
        "raw_clusters": raw_clusters,
        "raw_diagnostics": raw_diagnostics,
        "normalized_clusters": normalized_clusters,
        "normalized_diagnostics": normalized_diagnostics,
        "tiny_merge_diagnostics": [
            {
                "clusterId": cluster["clusterId"],
                "wordCount": cluster["wordCount"],
                "mergeTargetClusterId": cluster["mergeTargetClusterId"],
            }
            for cluster in raw_diagnostics
            if cluster["isTiny"]
        ],
    }


def build_cluster_diagnostics(*, leaf_nodes: list[dict], raw_clusters: list[list[int]]) -> list[dict]:
    return [
        _serialize_cluster(cluster_index, node_indexes, leaf_nodes)
        for cluster_index, node_indexes in enumerate(raw_clusters)
        if node_indexes
    ]


def _merge_tiny_clusters(*, raw_clusters: list[list[int]], diagnostics: list[dict]) -> list[list[int]]:
    if not raw_clusters:
        return []

    cluster_map = {
        cluster["clusterId"]: list(raw_clusters[index])
        for index, cluster in enumerate(diagnostics)
    }
    merged_clusters: list[list[int]] = []
    consumed_cluster_ids: set[str] = set()

    for cluster in diagnostics:
        cluster_id = cluster["clusterId"]
        if cluster_id in consumed_cluster_ids:
            continue

        if not cluster["isTiny"] or not cluster.get("mergeTargetClusterId"):
            merged_clusters.append(sorted(cluster_map[cluster_id]))
            consumed_cluster_ids.add(cluster_id)
            continue

        component_ids = _resolve_merge_component(cluster_id, diagnostics)
        consumed_cluster_ids.update(component_ids)

        merged_indexes: list[int] = []
        for component_id in component_ids:
            merged_indexes.extend(cluster_map.get(component_id, []))

        if merged_indexes:
            merged_clusters.append(sorted(set(merged_indexes)))

    return merged_clusters


def _resolve_merge_component(cluster_id: str, diagnostics: list[dict]) -> set[str]:
    by_id = {cluster["clusterId"]: cluster for cluster in diagnostics}
    component_ids = {cluster_id}
    current_id = cluster_id

    while True:
        next_id = by_id.get(current_id, {}).get("mergeTargetClusterId")
        if not next_id or next_id in component_ids:
            break
        component_ids.add(next_id)
        next_cluster = by_id.get(next_id)
        if not next_cluster or not next_cluster["isTiny"]:
            break
        current_id = next_id

    return component_ids


def _serialize_cluster(cluster_index: int, node_indexes: list[int], leaf_nodes: list[dict]) -> dict:
    nodes = [leaf_nodes[index] for index in node_indexes]
    word_count = sum(_word_count(node.get("content") or "") for node in nodes)
    page_start = min((node.get("page_start") or 0 for node in nodes), default=0) or None
    page_end = max((node.get("page_end") or 0 for node in nodes), default=0) or None
    layout_partition = _shared_metadata_value(nodes, "layout_partition") or _shared_metadata_value(nodes, "party_enclave")
    is_tiny = word_count < TINY_GROUP_WORDS
    is_summarizable = word_count >= MIN_SUMMARY_WORDS
    status = "invalid" if not is_summarizable else "tiny" if is_tiny else "summarizable"

    return {
        "clusterId": f"cluster-{cluster_index}",
        "wordCount": word_count,
        "nodeCount": len(nodes),
        "pageStart": page_start,
        "pageEnd": page_end,
        "layoutPartition": layout_partition or "mixed",
        "isTiny": is_tiny,
        "isSummarizable": is_summarizable,
        "isBelowSummaryMinimum": word_count < MIN_SUMMARY_WORDS,
        "status": status,
        "mergeTargetClusterId": None,
        "nodes": [_serialize_leaf_node(node) for node in nodes],
    }


def _serialize_leaf_node(node: dict) -> dict:
    content = (node.get("content") or "").strip()
    return {
        "id": node["id"],
        "chunkIndex": node.get("chunk_index"),
        "pageStart": node.get("page_start"),
        "pageEnd": node.get("page_end"),
        "wordCount": _word_count(content),
        "snippet": content[:SNIPPET_CHARS],
        "layoutPartition": (node.get("metadata") or {}).get("layout_partition")
        or (node.get("metadata") or {}).get("party_enclave"),
    }


def _assign_merge_targets(clusters: list[dict]) -> dict[str, str | None]:
    targets: dict[str, str | None] = {}

    for cluster in clusters:
        if not cluster["isTiny"]:
            continue

        candidates = [candidate for candidate in clusters if candidate["clusterId"] != cluster["clusterId"]]
        if not candidates:
            targets[cluster["clusterId"]] = None
            continue

        best_candidate = min(candidates, key=lambda candidate: _merge_score(cluster, candidate))
        targets[cluster["clusterId"]] = best_candidate["clusterId"]

    return targets


def _merge_score(source: dict, candidate: dict) -> tuple[int, int, int, int]:
    same_partition_penalty = 0 if source["layoutPartition"] == candidate["layoutPartition"] else 1
    page_distance = _page_distance(source, candidate)
    tiny_penalty = 1 if candidate["isTiny"] else 0
    return (same_partition_penalty, tiny_penalty, page_distance, candidate["wordCount"])


def _page_distance(source: dict, candidate: dict) -> int:
    source_start = source.get("pageStart") or source.get("pageEnd") or 0
    source_end = source.get("pageEnd") or source_start
    candidate_start = candidate.get("pageStart") or candidate.get("pageEnd") or 0
    candidate_end = candidate.get("pageEnd") or candidate_start

    if source_end < candidate_start:
        return candidate_start - source_end
    if candidate_end < source_start:
        return source_start - candidate_end
    return 0


def _shared_metadata_value(nodes: list[dict], key: str):
    values = [(node.get("metadata") or {}).get(key) for node in nodes]
    first_value = values[0] if values else None
    if first_value is not None and all(value == first_value for value in values):
        return first_value
    return None


def _word_count(text: str) -> int:
    return len(text.split())
