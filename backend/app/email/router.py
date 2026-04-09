"""Email connection and operations endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.email.gmail_client import (
    check_connection,
    disconnect_gmail,
    exchange_oauth_code,
    fetch_messages,
    send_email,
)

router = APIRouter()


class ConnectRequest(BaseModel):
    code: str
    redirect_uri: str


class SendRequest(BaseModel):
    to: str
    subject: str
    body: str
    thread_id: str | None = None


@router.post("/connect")
async def connect_gmail(
    req: ConnectRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Exchange OAuth code and store Gmail tokens."""
    try:
        return await exchange_oauth_code(req.code, req.redirect_uri, str(user_id), db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/status")
async def gmail_status(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Check Gmail connection status."""
    return await check_connection(str(user_id), db)


@router.delete("/disconnect")
async def gmail_disconnect(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Disconnect Gmail and revoke tokens."""
    return await disconnect_gmail(str(user_id), db)


@router.get("/inbox")
async def get_inbox(
    max_results: int = 20,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, str]]:
    """Fetch inbox emails from Gmail."""
    from app.email.gmail_client import get_valid_token

    try:
        token, _ = await get_valid_token(str(user_id), db)
        return await fetch_messages(token, max_results, label_id="INBOX")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/inbox/{message_id}")
async def get_message(
    message_id: str,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Get a single email's full details."""
    from app.email.gmail_client import fetch_full_message, get_valid_token

    try:
        token, _ = await get_valid_token(str(user_id), db)
        return await fetch_full_message(token, message_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/sent")
async def get_sent(
    max_results: int = 50,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, str]]:
    """Fetch sent emails from Gmail (used for style analysis)."""
    from app.email.gmail_client import get_valid_token

    try:
        token, _ = await get_valid_token(str(user_id), db)
        return await fetch_messages(token, max_results, query="in:sent", label_id="SENT")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/send")
async def send(
    req: SendRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    """Send an email via Gmail."""
    from app.email.gmail_client import get_valid_token

    try:
        token, _ = await get_valid_token(str(user_id), db)
        return await send_email(token, req.to, req.subject, req.body, req.thread_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
