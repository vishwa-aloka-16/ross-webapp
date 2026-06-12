import copy
import sys
import types
import unittest
from unittest.mock import patch

psycopg_stub = types.ModuleType("psycopg")
psycopg_stub.connect = lambda *_args, **_kwargs: None
psycopg_stub.rows = types.SimpleNamespace(dict_row=object())

psycopg_types_stub = types.ModuleType("psycopg.types")
psycopg_types_json_stub = types.ModuleType("psycopg.types.json")
psycopg_types_json_stub.Jsonb = lambda value: value

pgvector_stub = types.ModuleType("pgvector")
pgvector_psycopg_stub = types.ModuleType("pgvector.psycopg")
pgvector_psycopg_stub.register_vector = lambda *_args, **_kwargs: None

pydantic_settings_stub = types.ModuleType("pydantic_settings")


class _BaseSettings:
    def __init__(self, **kwargs):
        for name, value in self.__class__.__dict__.items():
            if name.startswith("_") or callable(value):
                continue
            setattr(self, name, kwargs.get(name, value))


pydantic_settings_stub.BaseSettings = _BaseSettings
pydantic_settings_stub.SettingsConfigDict = dict

google_stub = types.ModuleType("google")
google_genai_stub = types.ModuleType("google.genai")
google_genai_stub.Client = object
google_genai_types_stub = types.ModuleType("google.genai.types")
google_genai_types_stub.EmbedContentConfig = object
google_stub.genai = google_genai_stub
google_genai_stub.types = google_genai_types_stub

supabase_stub = types.ModuleType("supabase")
supabase_stub.create_client = lambda *_args, **_kwargs: object()

sys.modules.setdefault("psycopg", psycopg_stub)
sys.modules.setdefault("psycopg.types", psycopg_types_stub)
sys.modules.setdefault("psycopg.types.json", psycopg_types_json_stub)
sys.modules.setdefault("pgvector", pgvector_stub)
sys.modules.setdefault("pgvector.psycopg", pgvector_psycopg_stub)
sys.modules.setdefault("pydantic_settings", pydantic_settings_stub)
sys.modules.setdefault("google", google_stub)
sys.modules.setdefault("google.genai", google_genai_stub)
sys.modules.setdefault("google.genai.types", google_genai_types_stub)
sys.modules.setdefault("supabase", supabase_stub)

from app import create_app
from services.cluster_debug_service import build_cluster_preview
from services.cluster_planning_service import build_cluster_diagnostics, build_cluster_plan


def node(node_id: str, words: int, page: int, partition: str = "A") -> dict:
    return {
        "id": node_id,
        "content": "word " * words,
        "page_start": page,
        "page_end": page,
        "chunk_index": int(node_id.replace("n", "")),
        "metadata": {"layout_partition": partition},
    }


class ClusterPlanningTests(unittest.TestCase):
    def test_tiny_clusters_are_flagged_below_two_hundred_words(self):
        leaf_nodes = [node("n0", 120, 1), node("n1", 70, 2), node("n2", 240, 3)]

        clusters = build_cluster_diagnostics(
            leaf_nodes=leaf_nodes,
            raw_clusters=[[0, 1], [2]],
        )

        self.assertTrue(clusters[0]["isTiny"])
        self.assertEqual(clusters[0]["status"], "tiny")
        self.assertFalse(clusters[1]["isTiny"])

    def test_groups_below_one_hundred_words_are_invalid_for_summarization(self):
        leaf_nodes = [node("n0", 40, 1), node("n1", 50, 2), node("n2", 120, 3)]

        clusters = build_cluster_diagnostics(
            leaf_nodes=leaf_nodes,
            raw_clusters=[[0, 1], [2]],
        )

        self.assertFalse(clusters[0]["isSummarizable"])
        self.assertEqual(clusters[0]["status"], "invalid")
        self.assertTrue(clusters[1]["isSummarizable"])

    def test_tiny_cluster_gets_nearest_same_partition_merge_target(self):
        leaf_nodes = [
            node("n0", 40, 1, "A"),
            node("n1", 220, 2, "B"),
            node("n2", 220, 10, "A"),
        ]
        embeddings = [[1.0, 0.0], [2.0, 0.0], [3.0, 0.0]]

        plan = build_cluster_plan(
            current_nodes=leaf_nodes,
            current_embeddings=embeddings,
            target_clusters=3,
            level=1,
            cluster_fn=lambda *_args, **_kwargs: [[0], [1], [2]],
        )

        self.assertEqual(plan["raw_diagnostics"][0]["mergeTargetClusterId"], "cluster-2")

    def test_preview_does_not_mutate_leaf_nodes(self):
        leaf_nodes = [node("n0", 120, 1), node("n1", 130, 2)]
        original_nodes = copy.deepcopy(leaf_nodes)

        preview = build_cluster_preview_for_nodes(leaf_nodes)

        self.assertEqual(leaf_nodes, original_nodes)
        self.assertEqual(preview["leafCount"], 2)


class ClusterDebugEndpointTests(unittest.TestCase):
    def setUp(self):
        self.client = create_app().test_client()

    def test_debug_endpoint_returns_cluster_preview_for_indexed_leaf_nodes(self):
        preview_payload = {
            "documentId": "doc-1",
            "layoutStrategy": "ADVERSARIAL",
            "leafCount": 2,
            "clusterCount": 1,
            "tinyClusterCount": 0,
            "minSummaryWords": 100,
            "tinyGroupWords": 200,
            "targetClusters": 1,
            "clusters": [
                {
                    "clusterId": "cluster-0",
                    "wordCount": 250,
                    "nodeCount": 2,
                    "pageStart": 1,
                    "pageEnd": 2,
                    "layoutPartition": "A",
                    "isTiny": False,
                    "isSummarizable": True,
                    "isBelowSummaryMinimum": False,
                    "status": "summarizable",
                    "mergeTargetClusterId": None,
                    "nodes": [],
                }
            ],
        }

        with patch("app.build_cluster_preview", return_value=preview_payload) as preview_mock:
            response = self.client.post(
                "/debug/clusters",
                json={
                    "ownerId": "owner-1",
                    "documentId": "doc-1",
                    "layoutStrategy": "ADVERSARIAL",
                },
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["leafCount"], 2)
        preview_mock.assert_called_once()

    def test_debug_endpoint_rejects_non_positive_target_clusters(self):
        response = self.client.post(
            "/debug/clusters",
            json={
                "ownerId": "owner-1",
                "documentId": "doc-1",
                "layoutStrategy": "ADVERSARIAL",
                "targetClusters": 0,
            },
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("positive integer", response.get_json()["error"])


def build_cluster_preview_for_nodes(leaf_nodes: list[dict]) -> dict:
    stored_leaf_nodes = [
        {
            **node_payload,
            "embedding": [float(index + 1), float(index + 2)],
        }
        for index, node_payload in enumerate(copy.deepcopy(leaf_nodes))
    ]

    with patch(
        "services.cluster_debug_service.fetch_document_leaf_nodes_with_embeddings",
        return_value=stored_leaf_nodes,
    ):
        return build_cluster_preview(
            owner_id="owner-1",
            document_id="doc-1",
            layout_strategy="ADVERSARIAL",
            target_clusters=len(leaf_nodes),
        )


if __name__ == "__main__":
    unittest.main()
