import asyncio
import logging
import threading
from uuid import uuid4

from db.pgvector import delete_document_nodes, insert_nodes
from services.chunking_service import chunk_document, normalize_layout_strategy
from services.clustering_service import cluster_adversarially, cluster_globally
from services.embedding_service import batch_embed_texts
from services.gateway_callback_service import update_gateway_status
from services.pdf_extraction_service import extract_pdf_pages
from services.raptor_service import build_structural_summary_nodes, build_summary_nodes
from services.storage_service import download_pdf

logger = logging.getLogger(__name__)

job_statuses: dict[str, dict] = {}


def queue_ingestion(document_id: str, owner_id: str, file_name: str, storage_path: str, layout_strategy: str | None = None) -> None:
    normalized_layout_strategy = normalize_layout_strategy(layout_strategy)
    job_statuses[document_id] = {"status": "pending", "error": None}
    worker = threading.Thread(
        target=lambda: asyncio.run(
            process_document(
                document_id,
                owner_id,
                file_name,
                storage_path,
                normalized_layout_strategy,
            )
        ),
        name=f"ingestion-{document_id}",
        daemon=True,
    )
    worker.start()


async def process_document(document_id: str, owner_id: str, file_name: str, storage_path: str, layout_strategy: str) -> None:
    logger.info(
        "ingestion_start document_id=%s file_name=%s layout_strategy=%s",
        document_id,
        file_name,
        layout_strategy,
    )
    job_statuses[document_id] = {"status": "processing", "error": None}
    await update_gateway_status(document_id, "processing")

    try:
        pdf_bytes = download_pdf(storage_path)
        logger.info("ingestion_stage document_id=%s stage=download_complete bytes=%s", document_id, len(pdf_bytes))
        pages = extract_pdf_pages(pdf_bytes)
        logger.info("ingestion_stage document_id=%s stage=pdf_extracted pages=%s", document_id, len(pages))
        chunks = chunk_document(pages, layout_strategy)
        logger.info("ingestion_stage document_id=%s stage=chunking_complete chunks=%s", document_id, len(chunks))

        leaf_texts = [chunk["content"] for chunk in chunks]
        leaf_embeddings = await batch_embed_texts(leaf_texts, task_type="RETRIEVAL_DOCUMENT")
        logger.info("ingestion_stage document_id=%s stage=leaf_embeddings_complete count=%s", document_id, len(leaf_embeddings))

        leaf_nodes = []
        for chunk, embedding in zip(chunks, leaf_embeddings, strict=True):
            leaf_nodes.append(
                {
                    "id": str(uuid4()),
                    "document_id": document_id,
                    "owner_id": owner_id,
                    "node_type": "leaf",
                    "level": 0,
                    "parent_id": None,
                    "content": chunk["content"],
                    "embedding": embedding,
                    "page_start": chunk["page_start"],
                    "page_end": chunk["page_end"],
                    "chunk_index": chunk["chunk_index"],
                    "cluster_id": None,
                    "metadata": chunk.get("metadata", {}),
                }
            )

        if layout_strategy == "HIERARCHICAL":
            summary_nodes = await build_structural_summary_nodes(
                document_id=document_id,
                owner_id=owner_id,
                leaf_nodes=leaf_nodes,
                embed_fn=lambda texts: batch_embed_texts(texts, task_type="RETRIEVAL_DOCUMENT"),
            )
        else:
            cluster_fn = cluster_adversarially if layout_strategy == "ADVERSARIAL" else cluster_globally
            summary_nodes = await build_summary_nodes(
                document_id=document_id,
                owner_id=owner_id,
                leaf_nodes=leaf_nodes,
                leaf_embeddings=leaf_embeddings,
                cluster_fn=cluster_fn,
                embed_fn=lambda texts: batch_embed_texts(texts, task_type="RETRIEVAL_DOCUMENT"),
            )
        logger.info("ingestion_stage document_id=%s stage=raptor_complete summaries=%s", document_id, len(summary_nodes))

        delete_document_nodes(document_id)
        insert_nodes(leaf_nodes + summary_nodes)
        logger.info(
            "ingestion_stage document_id=%s stage=vector_store_complete total_nodes=%s",
            document_id,
            len(leaf_nodes) + len(summary_nodes),
        )

        job_statuses[document_id] = {"status": "indexed", "error": None}
        await update_gateway_status(document_id, "indexed")
        logger.info(
            "ingestion_complete document_id=%s chunks=%s summaries=%s layout_strategy=%s",
            document_id,
            len(leaf_nodes),
            len(summary_nodes),
            layout_strategy,
        )
    except Exception as error:  # noqa: BLE001
        logger.exception("ingestion_failed document_id=%s", document_id)
        job_statuses[document_id] = {"status": "failed", "error": str(error)}
        await update_gateway_status(document_id, "failed", str(error))


def get_job_status(document_id: str) -> dict:
    return job_statuses.get(document_id, {"status": "unknown", "error": None})
