"""Auth verification endpoints."""

import uuid

from fastapi import APIRouter, Depends

from app.auth.middleware import verify_supabase_jwt

router = APIRouter()


@router.get("/verify")
async def verify_token(user_id: uuid.UUID = Depends(verify_supabase_jwt)) -> dict[str, str]:
    """Verify that the caller's Supabase JWT is valid."""
    return {"status": "authenticated", "user_id": str(user_id)}
