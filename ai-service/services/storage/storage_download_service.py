from services.storage_service import download_pdf


class StorageDownloadService:
    def download_pdf(self, storage_path: str) -> bytes:
        return download_pdf(storage_path)
