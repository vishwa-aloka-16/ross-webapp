import asyncio
import logging
import threading

from models.ingestion_job import IngestionJob
from services.orchestrator.ingestion_orchestrator import IngestionOrchestrator

logger = logging.getLogger(__name__)

job_statuses: dict[str, dict] = {}


def queue_ingestion(
    document_id: str,
    owner_id: str,
    file_name: str,
    storage_path: str,
    layout_strategy: str | None = None,
) -> None:
    payload = {
        "documentId": document_id,
        "ownerId": owner_id,
        "fileName": file_name,
        "storagePath": storage_path,
        "layoutStrategy": layout_strategy,
    }
    job = IngestionJob.from_payload(payload)
    job_statuses[document_id] = {"status": "pending", "error": None}
    worker = threading.Thread(
        target=lambda: asyncio.run(process_document(payload)),
        name=f"ingestion-{document_id}",
        daemon=True,
    )
    worker.start()


async def process_document(job_payload: dict):
    job = IngestionJob.from_payload(job_payload)
    orchestrator = IngestionOrchestrator(job_statuses=job_statuses)
    logger.info(
        "ingestion_start document_id=%s file_name=%s layout_strategy=%s",
        job.document_id,
        job.file_name,
        job.layout_strategy,
    )
    try:
        return await orchestrator.run(job)
    except Exception as error:  # noqa: BLE001
        logger.exception("ingestion_failed document_id=%s", job.document_id)
        job_statuses[job.document_id] = {"status": "failed", "error": str(error)}
        await orchestrator.document_status_repository.update(
            document_id=job.document_id,
            status="failed",
            error=str(error),
            stage=job_statuses.get(job.document_id, {}).get("stage"),
            progress=job_statuses.get(job.document_id, {}).get("progress"),
        )
        return {"status": "failed", "error": str(error), "documentId": job.document_id}


def get_job_status(document_id: str) -> dict:
    return job_statuses.get(document_id, {"status": "unknown", "error": None})
