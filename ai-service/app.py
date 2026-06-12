import asyncio
from functools import wraps

from flask import Blueprint, Flask, jsonify, request
from pydantic import ValidationError

from core.logging import configure_logging
from db.pgvector import ensure_schema
from core.security import validate_internal_service_key
from schemas.health import HealthCheck, HealthResponse
from schemas.ingestion import IngestionRequest, IngestionStatusResponse
from schemas.query import Citation, QueryRequest, QueryResponse
from services.answer_service import generate_rag_answer
from services.cluster_debug_service import build_cluster_preview
from services.health_service import log_startup_health_summary
from services.ingestion_service import get_job_status, queue_ingestion
from services.retrieval_service import retrieve_context
from services.summary_tree_service import build_summary_tree
from services.summary_queue import summary_queue


def require_internal_service_key(view_func):
    @wraps(view_func)
    def wrapper(*args, **kwargs):
        try:
            validate_internal_service_key(request.headers)
        except PermissionError as error:
            return jsonify({"detail": str(error)}), 401
        return view_func(*args, **kwargs)

    return wrapper


def create_app() -> Flask:
    configure_logging()
    ensure_schema()
    log_startup_health_summary()

    app = Flask(__name__)
    api = Blueprint("api", __name__)

    @api.get("/health")
    def health():
        from services.health_service import collect_health_checks, overall_status

        checks = collect_health_checks()
        response = HealthResponse(
            status=overall_status(checks),
            checks={name: HealthCheck(**payload) for name, payload in checks.items()},
        )
        return jsonify(response.model_dump())

    @api.post("/ingestion/documents")
    @require_internal_service_key
    def ingest_document():
        try:
            payload = IngestionRequest(**(request.get_json(silent=True) or {}))
        except ValidationError as error:
            return jsonify({"detail": error.errors()}), 400

        queue_ingestion(
            payload.documentId,
            payload.ownerId,
            payload.fileName,
            payload.storagePath,
            payload.layoutStrategy,
        )
        return jsonify({"accepted": True, "documentId": payload.documentId}), 202

    @api.get("/ingestion/documents/<document_id>/status")
    @require_internal_service_key
    def ingestion_status(document_id: str):
        status_payload = get_job_status(document_id)
        response = IngestionStatusResponse(
            documentId=document_id,
            status=status_payload["status"],
            error=status_payload.get("error"),
        )
        return jsonify(response.model_dump())

    @api.post("/rag/query")
    @require_internal_service_key
    def rag_query():
        try:
            payload = QueryRequest(**(request.get_json(silent=True) or {}))
        except ValidationError as error:
            return jsonify({"detail": error.errors()}), 400

        summary_nodes, leaf_nodes = asyncio.run(
            retrieve_context(
                owner_id=payload.ownerId,
                document_id=payload.documentId,
                question=payload.question,
            )
        )
        answer = asyncio.run(
            generate_rag_answer(
                question=payload.question,
                summary_nodes=summary_nodes,
                leaf_nodes=leaf_nodes,
            )
        )

        citations = [
            Citation(
                node_id=node["id"],
                node_type=node["node_type"],
                level=node["level"],
                page_start=node.get("page_start"),
                page_end=node.get("page_end"),
                snippet=node["content"][:280],
            )
            for node in leaf_nodes[:6]
        ]

        response = QueryResponse(
            answer=answer,
            citations=citations,
            matched_nodes=[*summary_nodes, *leaf_nodes],
            document_id=payload.documentId,
        )
        return jsonify(response.model_dump())

    @api.post("/rag/summary-tree")
    @require_internal_service_key
    def summary_tree():
        body = request.get_json(silent=True) or {}
        owner_id = body.get("ownerId")
        document_id = body.get("documentId")

        if not owner_id or not document_id:
            return jsonify({"error": "ownerId and documentId are required."}), 400

        return jsonify(build_summary_tree(owner_id=owner_id, document_id=document_id))

    @api.post("/debug/clusters")
    @require_internal_service_key
    def debug_clusters():
        body = request.get_json(silent=True) or {}
        owner_id = body.get("ownerId")
        document_id = body.get("documentId")
        layout_strategy = body.get("layoutStrategy")
        target_clusters = body.get("targetClusters")

        if not owner_id or not document_id:
            return jsonify({"error": "ownerId and documentId are required."}), 400

        try:
            target_clusters = int(target_clusters) if target_clusters not in (None, "") else None
        except (TypeError, ValueError):
            return jsonify({"error": "targetClusters must be a positive integer when provided."}), 400

        if target_clusters is not None and target_clusters <= 0:
            return jsonify({"error": "targetClusters must be a positive integer when provided."}), 400

        try:
            return jsonify(
                build_cluster_preview(
                    owner_id=owner_id,
                    document_id=document_id,
                    layout_strategy=layout_strategy,
                    target_clusters=target_clusters,
                )
            )
        except Exception as error:  # noqa: BLE001
            return jsonify({"error": str(error)}), 500

    app.register_blueprint(api)
    return app
