from __future__ import annotations

import base64
import os
from functools import lru_cache

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _b64decode(value: str) -> bytes:
    return base64.b64decode(value.encode("utf-8"))


def _b64encode(value: bytes) -> str:
    return base64.b64encode(value).decode("utf-8")


@lru_cache(maxsize=1)
def get_processing_private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def get_processing_public_key_pem() -> str:
    public_key = get_processing_private_key().public_key()
    pem_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    return pem_bytes.decode("utf-8")


def decrypt_session_dek(encrypted_session_dek: str) -> bytes:
    private_key = get_processing_private_key()
    return private_key.decrypt(
        _b64decode(encrypted_session_dek),
        padding.OAEP(
            mgf=padding.MGF1(algorithm=hashes.SHA256()),
            algorithm=hashes.SHA256(),
            label=None,
        ),
    )


def decrypt_document_bytes(ciphertext: bytes, file_iv: str, dek_bytes: bytes) -> bytes:
    return AESGCM(dek_bytes).decrypt(_b64decode(file_iv), ciphertext, None)


def encrypt_text_content(text: str, dek_bytes: bytes) -> tuple[str, str, str]:
    iv = os.urandom(12)
    aesgcm = AESGCM(dek_bytes)
    ciphertext = aesgcm.encrypt(iv, text.encode("utf-8"), None)
    return _b64encode(ciphertext), _b64encode(iv), "ross-aes-gcm-v1"


def decrypt_text_content(ciphertext_b64: str, content_iv: str, dek_bytes: bytes) -> str:
    plaintext = AESGCM(dek_bytes).decrypt(
        _b64decode(content_iv),
        _b64decode(ciphertext_b64),
        None,
    )
    return plaintext.decode("utf-8")
