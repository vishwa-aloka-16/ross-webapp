import math

import numpy as np
from sklearn.mixture import GaussianMixture


def cluster_embeddings(vectors: list[list[float]], target_clusters: int | None = None) -> list[list[int]]:
    if len(vectors) <= 1:
        return [[0]] if vectors else []
    if len(vectors) == 2:
        return [[0, 1]]

    cluster_count = target_clusters or max(2, min(5, math.ceil(math.sqrt(len(vectors) / 2))))
    cluster_count = max(1, min(cluster_count, len(vectors)))

    if cluster_count == 1:
        return [list(range(len(vectors)))]
    if cluster_count >= len(vectors):
        return [list(range(len(vectors)))]

    matrix = np.array(vectors)
    model = GaussianMixture(n_components=cluster_count, random_state=42)
    labels = model.fit_predict(matrix)

    clusters: dict[int, list[int]] = {}
    for index, label in enumerate(labels):
        clusters.setdefault(int(label), []).append(index)

    return list(clusters.values())


def cluster_globally(current_nodes: list[dict], current_embeddings: list[list[float]], target_clusters: int, level: int) -> list[list[int]]:
    _ = current_nodes, level
    return cluster_embeddings(current_embeddings, target_clusters)


def cluster_adversarially(
    current_nodes: list[dict],
    current_embeddings: list[list[float]],
    target_clusters: int,
    level: int,
) -> list[list[int]]:
    _ = level

    if len(current_nodes) <= 1:
        return [[0]] if current_nodes else []
    if target_clusters <= 1:
        return [list(range(len(current_nodes)))]

    partitions: dict[str, list[int]] = {}
    for index, node in enumerate(current_nodes):
        metadata = node.get("metadata") or {}
        partition_key = metadata.get("layout_partition") or metadata.get("party_enclave") or "UNKNOWN"
        partitions.setdefault(str(partition_key), []).append(index)

    if len(partitions) <= 1:
        return cluster_embeddings(current_embeddings, target_clusters)

    allocated = _allocate_cluster_counts(partitions, target_clusters)
    clusters: list[list[int]] = []

    for partition_key, node_indexes in partitions.items():
        partition_target = allocated.get(partition_key, 1)
        if len(node_indexes) <= 1 or partition_target <= 1:
            clusters.append(node_indexes)
            continue

        partition_vectors = [current_embeddings[index] for index in node_indexes]
        partition_clusters = cluster_embeddings(partition_vectors, partition_target)
        for partition_cluster in partition_clusters:
            clusters.append([node_indexes[index] for index in partition_cluster])

    return clusters


def _allocate_cluster_counts(partitions: dict[str, list[int]], target_clusters: int) -> dict[str, int]:
    requested = max(len(partitions), target_clusters)
    allocations = {
        key: 1 for key in partitions
    }
    remaining = max(0, requested - len(partitions))

    weighted = sorted(
        ((key, len(values)) for key, values in partitions.items() if len(values) > 1),
        key=lambda item: item[1],
        reverse=True,
    )

    while remaining > 0 and weighted:
        progressed = False
        for key, size in weighted:
            max_clusters = max(1, size - 1)
            if allocations[key] >= max_clusters:
                continue
            allocations[key] += 1
            remaining -= 1
            progressed = True
            if remaining == 0:
                break

        if not progressed:
            break

    return allocations
