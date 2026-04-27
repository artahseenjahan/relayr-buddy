"""Persona selection and build endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.services.persona_service import build_persona, get_latest_persona, list_selectable_messages, save_persona_selection

router = APIRouter()


class SourceEmailSelection(BaseModel):
    gmail_message_id: str
    gmail_thread_id: str | None = None
    direction: str = "sent"
    from_email: str | None = None
    to_emails: list[str] = Field(default_factory=list)
    subject: str | None = None
    snippet: str | None = None


class SaveSelectionRequest(BaseModel):
    persona_name: str | None = None
    selected_messages: list[SourceEmailSelection]


class BuildPersonaRequest(BaseModel):
    persona_profile_id: uuid.UUID | None = None


@router.get("/source-emails")
async def get_persona_source_candidates(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await list_selectable_messages(db, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/selection")
async def save_selection(
    req: SaveSelectionRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await save_persona_selection(
            db,
            user_id=user_id,
            selected_messages=[message.model_dump() for message in req.selected_messages],
            persona_name=req.persona_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/build")
async def build_selected_persona(
    req: BuildPersonaRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    try:
        return await build_persona(db, user_id=user_id, persona_profile_id=req.persona_profile_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/current")
async def get_current_persona(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    persona = await get_latest_persona(db, user_id=user_id)
    if not persona:
        raise HTTPException(status_code=404, detail="No persona found.")
    return {
        "id": str(persona.id),
        "name": persona.name,
        "tone_summary": persona.tone_summary,
        "style_summary": persona.style_summary,
        "greeting_patterns": persona.greeting_patterns,
        "signoff_patterns": persona.signoff_patterns,
        "length_preference": persona.length_preference,
        "formatting_preferences": persona.formatting_preferences,
        "preferred_phrases": persona.preferred_phrases,
        "do_not_use_phrases": persona.do_not_use_phrases,
        "source_email_count": persona.source_email_count,
        "status": persona.status.value,
        "last_built_at": persona.last_built_at.isoformat() if persona.last_built_at else None,
    }
