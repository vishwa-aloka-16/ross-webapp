from db.supabase_client import get_supabase
from core.config import settings


def download_pdf(path: str) -> bytes:
    supabase = get_supabase()
    return supabase.storage.from_(settings.supabase_storage_bucket).download(path)
