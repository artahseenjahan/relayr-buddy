"""Gmail connection and metadata endpoints for the Relayr MVP."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.services.gmail_service import (
    check_connection,
    disconnect_gmail,
    exchange_oauth_code,
    fetch_full_message,
    fetch_messages,
    fetch_thread,
    get_valid_token,
)

router = APIRouter()


class ConnectRequest(BaseModel):
    code: str
    redirect_uri: str


class PersonaMessageSelection(BaseModel):
    gmail_message_id: str
    gmail_thread_id: str | None = None
    direction: str = "sent"
    from_email: str | None = None
    to_emails: list[str] = Field(default_factory=list)
    subject: str | None = None
    snippet: str | None = None


@router.post("/connect")
async def connect_gmail(
    req: ConnectRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await exchange_oauth_code(req.code, req.redirect_uri, user_id, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/status")
async def gmail_status(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    return await check_connection(db, user_id)


@router.delete("/disconnect")
async def gmail_disconnect(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    return await disconnect_gmail(db, user_id)


@router.get("/inbox")
async def get_inbox(
    max_results: int = Query(default=20, ge=1, le=50),
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    try:
        _, token = await get_valid_token(db, user_id)
        return await fetch_messages(token, max_results=max_results, label_id="INBOX")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/sent")
async def get_sent(
    max_results: int = Query(default=30, ge=1, le=50),
    keywords: str | None = None,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    try:
        _, token = await get_valid_token(db, user_id)
        query = "in:sent"
        if keywords:
            parts = [part.strip() for part in keywords.split(",") if part.strip()][:5]
            if parts:
                query = f"in:sent ({' OR '.join(parts)})"
        return await fetch_messages(token, max_results=max_results, query=query, label_id="SENT")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/messages/selectable")
async def get_selectable_sent_messages(
    max_results: int = Query(default=30, ge=1, le=30),
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        _, token = await get_valid_token(db, user_id)
        messages = await fetch_messages(token, max_results=max_results, query="in:sent", label_id="SENT")
        return {"messages": messages, "max_selection": 30}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/messages/{message_id}")
async def get_message(
    message_id: str,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        _, token = await get_valid_token(db, user_id)
        return await fetch_full_message(token, message_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/threads/{thread_id}")
async def get_thread(
    thread_id: str,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        _, token = await get_valid_token(db, user_id)
        return await fetch_thread(token, thread_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
