class StatusReporter:
    def __init__(self, document_status_repository) -> None:
        self.document_status_repository = document_status_repository

    async def report(self, *, document_id: str, status: str, stage: str, progress: int, message: str, run_id: str) -> None:
        _ = message
        await self.document_status_repository.update(
            document_id=document_id,
            status=status,
            stage=stage,
            progress=progress,
            run_id=run_id,
        )
