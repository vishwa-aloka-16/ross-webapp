from functools import lru_cache

from supabase import create_client

from core.config import settings


@lru_cache(maxsize=1)
def get_supabase():
    supabase_key = (
        settings.supabase_key
        or settings.supabase_secret_key
        or settings.supabase_service_role_key
    )

    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL is not configured.")
    if not supabase_key:
        raise RuntimeError(
            "SUPABASE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY is not configured."
        )

    try:
        return create_client(settings.supabase_url, supabase_key)
    except Exception as error:  # noqa: BLE001
        raise RuntimeError(
            "Failed to initialize Supabase client. "
            "For server-side ingestion, use SUPABASE_KEY with a legacy service-role JWT or "
            "set SUPABASE_SERVICE_ROLE_KEY."
        ) from error
