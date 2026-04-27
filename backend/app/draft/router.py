"""Draft generation and lifecycle endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.services.draft_service import (
    approve_draft,
    generate_draft,
    get_draft_for_user,
    send_draft,
    serialize_draft,
    update_draft_body,
)

router = APIRouter()


class GenerateRequest(BaseModel):
    source_gmail_message_id: str
    persona_profile_id: uuid.UUID | None = None
    employee_profile_id: uuid.UUID | None = None


class DraftUpdateRequest(BaseModel):
    draft_body: str


@router.post("/generate")
async def generate_email_draft(
    req: GenerateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await generate_draft(
            db,
            user_id=user_id,
            source_gmail_message_id=req.source_gmail_message_id,
            persona_profile_id=req.persona_profile_id,
            employee_profile_id=req.employee_profile_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{draft_id}")
async def get_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        draft = await get_draft_for_user(db, user_id=user_id, draft_id=draft_id)
        return serialize_draft(draft)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{draft_id}")
async def update_draft(
    draft_id: uuid.UUID,
    req: DraftUpdateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await update_draft_body(db, user_id=user_id, draft_id=draft_id, draft_body=req.draft_body)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{draft_id}/approve")
async def approve_generated_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await approve_draft(db, user_id=user_id, draft_id=draft_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{draft_id}/send")
async def send_generated_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await send_draft(db, user_id=user_id, draft_id=draft_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
