from services.clustering_service import cluster_adversarially


class AdversarialClusterer:
    def cluster(self, current_nodes, current_embeddings, target_clusters: int, level: int):
        return cluster_adversarially(current_nodes, current_embeddings, target_clusters, level)
