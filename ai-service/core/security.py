import logging
from typing import Mapping

from core.config import settings

logger = logging.getLogger(__name__)


def validate_internal_service_key(headers: Mapping[str, str | None]) -> None:
    expected_key = (settings.internal_service_key or "").strip()
    provided_key = (headers.get("X-Internal-Service-Key") or headers.get("x-internal-service-key") or "").strip()

    if not expected_key:
        return

    if provided_key != expected_key:
        logger.warning(
            "internal_service_key_mismatch expected_length=%s provided_length=%s",
            len(expected_key),
            len(provided_key),
        )
        raise PermissionError("Invalid internal service key.")
