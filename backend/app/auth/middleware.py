"""Supabase JWT verification middleware for FastAPI.

Supabase issues RS256 (asymmetric) JWTs by default. HS256 with JWT secret is only used on
older / specific configurations — verify using the alg in the token header.
"""

import uuid
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError, PyJWKClient

from app.config import settings

security = HTTPBearer()

_jwks_client: PyJWKClient | None = None
DEBUG_LOG_PATH = Path("/Users/tahseenjahan/development/.cursor/debug-dfaa24.log")


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict[str, object]) -> None:
    payload = {
        "sessionId": "dfaa24",
        "runId": "pre-fix",
        "hypothesisId": hypothesis_id,
        "id": f"log_{uuid4().hex}",
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(datetime.now(UTC).timestamp() * 1000),
    }
    try:
        with DEBUG_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=True) + "\n")
    except Exception:
        pass


def _jwks_url() -> str:
    return f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(_jwks_url())
    return _jwks_client


def _decode_rs256(token: str) -> dict[str, object]:
    client = _get_jwks_client()
    signing_key = client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience="authenticated",
    )


def _decode_hs256(token: str) -> dict[str, object]:
    if not settings.supabase_jwt_secret:
        raise PyJWTError("SUPABASE_JWT_SECRET not set for HS256 token")
    return jwt.decode(
        token,
        settings.supabase_jwt_secret,
        algorithms=["HS256"],
        audience="authenticated",
    )


async def _decode_via_user_api(token: str) -> dict[str, object]:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.supabase_url.rstrip('/')}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey": settings.supabase_service_role_key,
            },
        )
        if resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return resp.json()


async def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """Verify the Supabase JWT and return the user_id."""
    token = credentials.credentials
    # region agent log
    _debug_log(
        "H6",
        "app/auth/middleware.py:verify_supabase_jwt:entry",
        "verify_supabase_jwt called",
        {"token_len": len(token), "has_supabase_url": bool(settings.supabase_url)},
    )
    # endregion

    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "")
        # region agent log
        _debug_log(
            "H7",
            "app/auth/middleware.py:verify_supabase_jwt:alg_branch",
            "jwt algorithm detected",
            {"alg": str(alg), "jwks_url": _jwks_url()},
        )
        # endregion

        if alg == "RS256":
            payload = _decode_rs256(token)
        elif alg == "HS256":
            payload = _decode_hs256(token)
        else:
            payload = await _decode_via_user_api(token)

        user_id_str = payload.get("sub") or payload.get("id")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user identifier",
            )

        # region agent log
        _debug_log(
            "H8",
            "app/auth/middleware.py:verify_supabase_jwt:success",
            "jwt verified successfully",
            {"has_sub": bool(payload.get("sub")), "has_id": bool(payload.get("id"))},
        )
        # endregion
        return uuid.UUID(str(user_id_str))

    except HTTPException:
        raise
    except PyJWTError as e:
        # region agent log
        _debug_log(
            "H9",
            "app/auth/middleware.py:verify_supabase_jwt:pyjwt_error",
            "jwt verification error",
            {"error_type": e.__class__.__name__, "error": str(e)},
        )
        # endregion
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"JWT verification failed: {e}",
        ) from e
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth service unreachable: {e}",
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid user ID in token: {e}",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        ) from e
