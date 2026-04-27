"""Application-layer encryption for provider tokens."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import settings


def _fernet() -> Fernet:
    key = (settings.app_encryption_key or "").strip()
    if key:
        return Fernet(key.encode("utf-8"))

    seed = (settings.supabase_jwt_secret or "relayr-dev-fallback").encode("utf-8")
    derived = base64.urlsafe_b64encode(hashlib.sha256(seed).digest())
    return Fernet(derived)


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str) -> str:
    return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
