"""Supabase JWT verification middleware for FastAPI."""

import uuid

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings

security = HTTPBearer()

# Cache the JWKS keys
_jwks_cache: dict[str, object] | None = None


async def _get_jwks() -> dict[str, object]:
    """Fetch Supabase JWKS for JWT verification."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = f"{settings.supabase_url}/auth/v1/.well-known/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(jwks_url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        return _jwks_cache


async def verify_supabase_jwt(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> uuid.UUID:
    """Verify the Supabase JWT and return the user_id.

    This dependency extracts the Bearer token, validates it against
    the Supabase JWT secret, and returns the authenticated user's UUID.
    """
    token = credentials.credentials

    try:
        if settings.supabase_jwt_secret:
            # Direct verification with JWT secret (faster, no network call)
            payload = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )
        else:
            # Fallback: verify via Supabase auth API
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    f"{settings.supabase_url}/auth/v1/user",
                    headers={"Authorization": f"Bearer {token}", "apikey": settings.supabase_service_role_key},
                )
                if resp.status_code != 200:
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Invalid or expired token",
                    )
                payload = resp.json()

        user_id_str = payload.get("sub") or payload.get("id")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user identifier",
            )

        return uuid.UUID(user_id_str)

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"JWT verification failed: {e}",
        ) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid user ID in token: {e}",
        ) from e
