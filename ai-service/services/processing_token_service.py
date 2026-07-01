from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from core.config import settings


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}")


def validate_processing_grant(token: str, *, document_id: str, owner_id: str) -> None:
    try:
        payload_b64, signature_b64 = token.split(".", 1)
    except ValueError as error:
      raise PermissionError("Malformed processing grant.") from error

    expected_signature = hmac.new(
        (settings.internal_service_key or "ross-internal").encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).digest()

    actual_signature = _b64url_decode(signature_b64)
    if not hmac.compare_digest(expected_signature, actual_signature):
        raise PermissionError("Invalid processing grant signature.")

    payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
    if payload.get("purpose") != "processing":
        raise PermissionError("Invalid processing grant purpose.")
    if payload.get("documentId") != document_id or payload.get("ownerId") != owner_id:
        raise PermissionError("Processing grant does not match the document.")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise PermissionError("Processing grant has expired.")
