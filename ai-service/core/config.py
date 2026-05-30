from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parents[1]
ENV_PATH = BASE_DIR / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ENV_PATH), extra="ignore")

    ai_service_port: int = Field(default=8000, alias="PORT")
    ai_service_host: str = "0.0.0.0"
    internal_service_key: str = ""
    gateway_url: str = "http://localhost:3001"
    gateway_internal_status_path: str = "/api/documents/internal/{document_id}/ingestion-status"

    gemini_api_key: str = ""
    embedding_model_name: str = "gemini-embedding-2"
    summarization_model_name: str = "gemini-3.5-flash"
    answer_model_name: str = "gemini-3.5-flash"
    embedding_batch_size: int = 15
    embedding_output_dimensions: int = 1536
    summary_request_interval_seconds: float = 4.0
    max_summary_retries: int = 5
    max_embedding_retries: int = 5

    supabase_url: str = ""
    supabase_key: str = ""
    supabase_secret_key: str = ""
    supabase_service_role_key: str = ""
    supabase_storage_bucket: str = "documents"
    supabase_db_url: str = ""


settings = Settings()
