from __future__ import annotations

from services.gateway_callback_service import update_gateway_status


class DocumentStatusRepository:
    def __init__(self, job_statuses: dict[str, dict]) -> None:
        self.job_statuses = job_statuses

    async def update(self, *, document_id: str, status: str, error: str | None = None, stage: str | None = None, progress: int | None = None, run_id: str | None = None) -> None:
        self.job_statuses[document_id] = {
            "status": status,
            "error": error,
            "stage": stage,
            "progress": progress,
            "runId": run_id,
        }
        gateway_status = "processing" if status not in {"indexed", "failed", "pending"} else status
        await update_gateway_status(document_id, gateway_status, error)
