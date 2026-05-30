from __future__ import annotations

import logging

import psycopg

from core.config import settings
from db.pgvector import get_connection

logger = logging.getLogger(__name__)


def _ok(detail: str) -> dict[str, str]:
    return {"status": "ok", "detail": detail}


def _warn(detail: str) -> dict[str, str]:
    return {"status": "warn", "detail": detail}


def _error(detail: str) -> dict[str, str]:
    return {"status": "error", "detail": detail}


def _check_internal_service_key() -> dict[str, str]:
    if not settings.internal_service_key:
        return _warn("INTERNAL_SERVICE_KEY is missing. Internal service auth is disabled for local testing.")
    return _ok("Internal service key is configured.")


def _check_gemini() -> dict[str, str]:
    if not settings.gemini_api_key:
        return _error("GEMINI_API_KEY is missing.")
    return _ok(
        f"Gemini is configured for embeddings={settings.embedding_model_name}, "
        f"summarization={settings.summarization_model_name}, answers={settings.answer_model_name}."
    )


def _check_supabase_storage() -> dict[str, str]:
    if not settings.supabase_url:
        return _error("SUPABASE_URL is missing.")
    if not (settings.supabase_key or settings.supabase_secret_key or settings.supabase_service_role_key):
        return _error("SUPABASE_KEY, SUPABASE_SECRET_KEY, or SUPABASE_SERVICE_ROLE_KEY is missing.")
    if not settings.supabase_storage_bucket:
        return _error("SUPABASE_STORAGE_BUCKET is missing.")
    if settings.supabase_key:
        key_source = "SUPABASE_KEY"
    elif settings.supabase_secret_key:
        key_source = "SUPABASE_SECRET_KEY"
    else:
        key_source = "SUPABASE_SERVICE_ROLE_KEY"
    return _ok(
        f"Supabase storage is configured for bucket={settings.supabase_storage_bucket} using {key_source}."
    )


def _check_pgvector() -> dict[str, str]:
    if not settings.supabase_db_url:
        return _warn("SUPABASE_DB_URL is missing. Vector storage is disabled until it is configured.")

    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("select exists (select 1 from pg_extension where extname = 'vector')")
                vector_enabled = bool(cur.fetchone()[0])
                cur.execute("select to_regclass('public.raptor_nodes')")
                table_name = cur.fetchone()[0]
    except psycopg.OperationalError as error:
        return _error(f"Could not connect to Supabase Postgres. {error}")
    except Exception as error:  # noqa: BLE001
        return _error(f"Unexpected pgvector check failure. {error}")

    if not vector_enabled:
        return _error("pgvector extension is not enabled. Run `create extension if not exists vector;` in Supabase SQL editor.")
    if not table_name:
        return _warn("pgvector is enabled, but `public.raptor_nodes` is missing. It will be created when schema initialization succeeds.")

    return _ok("pgvector extension and `public.raptor_nodes` are available.")


def collect_health_checks() -> dict[str, dict[str, str]]:
    return {
        "internal_service_key": _check_internal_service_key(),
        "gemini": _check_gemini(),
        "supabase_storage": _check_supabase_storage(),
        "pgvector": _check_pgvector(),
    }


def overall_status(checks: dict[str, dict[str, str]]) -> str:
    statuses = {check["status"] for check in checks.values()}
    if "error" in statuses:
        return "error"
    if "warn" in statuses:
        return "warn"
    return "ok"


def log_startup_health_summary() -> None:
    checks = collect_health_checks()
    status = overall_status(checks)
    logger.info("startup_health status=%s", status)
    for name, check in checks.items():
        logger.info("startup_health_check name=%s status=%s detail=%s", name, check["status"], check["detail"])
