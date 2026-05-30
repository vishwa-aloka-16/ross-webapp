import httpx

from core.config import settings


async def update_gateway_status(document_id: str, ingestion_status: str, ingestion_error: str | None = None) -> None:
    path = settings.gateway_internal_status_path.format(document_id=document_id)
    headers = {}
    if settings.internal_service_key:
        headers["X-Internal-Service-Key"] = settings.internal_service_key

    async with httpx.AsyncClient(timeout=60) as client:
        await client.post(
            f"{settings.gateway_url}{path}",
            headers=headers,
            json={
                "ingestionStatus": ingestion_status,
                "ingestionError": ingestion_error,
            },
        )
