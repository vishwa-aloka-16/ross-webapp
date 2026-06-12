from services.clustering_service import cluster_globally


class GlobalClusterer:
    def cluster(self, current_nodes, current_embeddings, target_clusters: int, level: int):
        return cluster_globally(current_nodes, current_embeddings, target_clusters, level)
