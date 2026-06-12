class StructuralClusterer:
    def cluster(self, current_nodes, current_embeddings, target_clusters: int, level: int):
        _ = target_clusters, level, current_embeddings
        return [list(range(len(current_nodes)))] if current_nodes else []
