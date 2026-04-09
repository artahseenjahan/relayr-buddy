"""Persona calibration and writing style profile endpoints (Layer 1)."""

import json
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.email.gmail_client import fetch_full_message, fetch_messages, get_valid_token
from app.models.persona import EmailStyleSample, WritingStyleProfile
from app.persona.llm_client import aggregate_style_profiles, analyze_email_style

router = APIRouter()


class CalibrateRequest(BaseModel):
    max_emails: int = 20


class CalibrateResponse(BaseModel):
    status: str
    samples_analyzed: int
    profile: dict[str, object] | None = None


class StyleProfileResponse(BaseModel):
    formality_score: float | None = None
    warmth_score: float | None = None
    conciseness_score: float | None = None
    avg_sentence_length: float | None = None
    common_greetings: list[str] = []
    common_closings: list[str] = []
    style_summary: str | None = None
    sample_count: int = 0


@router.post("/calibrate")
async def calibrate_persona(
    req: CalibrateRequest,
    background_tasks: BackgroundTasks,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> CalibrateResponse:
    """Analyze sent emails to build a writing style profile.

    Fetches the user's sent emails from Gmail, runs LLM analysis on each,
    then aggregates into a unified style profile.
    """
    try:
        token, _ = await get_valid_token(str(user_id), db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Fetch sent email metadata
    sent_messages = await fetch_messages(token, req.max_emails, query="in:sent", label_id="SENT")

    if not sent_messages:
        return CalibrateResponse(status="no_emails", samples_analyzed=0)

    # Analyze each email's style
    analyses: list[dict[str, object]] = []
    samples_saved = 0

    for msg in sent_messages[:req.max_emails]:
        try:
            full_msg = await fetch_full_message(token, msg["id"])
            body = full_msg.get("body", "")
            if not body or not isinstance(body, str) or len(body) < 50:
                continue

            analysis = await analyze_email_style(body)
            if "error" not in analysis:
                analyses.append(analysis)

                # Save sample metadata (no body stored)
                sample = EmailStyleSample(
                    user_id=user_id,
                    gmail_message_id=msg["id"],
                    subject=msg.get("subject"),
                    style_features_json=json.dumps(analysis),
                )
                db.add(sample)
                samples_saved += 1
        except Exception:
            continue

    if not analyses:
        return CalibrateResponse(status="analysis_failed", samples_analyzed=0)

    # Aggregate into unified profile
    aggregated = await aggregate_style_profiles(analyses)

    # Upsert writing style profile
    result = await db.execute(
        select(WritingStyleProfile).where(WritingStyleProfile.user_id == user_id)
    )
    existing_profile = result.scalar_one_or_none()

    if existing_profile:
        existing_profile.formality_score = aggregated.get("formality_score")  # type: ignore[assignment]
        existing_profile.warmth_score = aggregated.get("warmth_score")  # type: ignore[assignment]
        existing_profile.conciseness_score = aggregated.get("conciseness_score")  # type: ignore[assignment]
        existing_profile.avg_sentence_length = aggregated.get("avg_sentence_length")  # type: ignore[assignment]
        existing_profile.common_greetings = aggregated.get("common_greetings", [])  # type: ignore[assignment]
        existing_profile.common_closings = aggregated.get("common_closings", [])  # type: ignore[assignment]
        existing_profile.style_summary = aggregated.get("style_summary")  # type: ignore[assignment]
        existing_profile.sample_count = samples_saved
    else:
        profile = WritingStyleProfile(
            user_id=user_id,
            formality_score=aggregated.get("formality_score"),  # type: ignore[arg-type]
            warmth_score=aggregated.get("warmth_score"),  # type: ignore[arg-type]
            conciseness_score=aggregated.get("conciseness_score"),  # type: ignore[arg-type]
            avg_sentence_length=aggregated.get("avg_sentence_length"),  # type: ignore[arg-type]
            common_greetings=aggregated.get("common_greetings", []),  # type: ignore[arg-type]
            common_closings=aggregated.get("common_closings", []),  # type: ignore[arg-type]
            style_summary=aggregated.get("style_summary"),  # type: ignore[arg-type]
            sample_count=samples_saved,
        )
        db.add(profile)

    return CalibrateResponse(
        status="completed",
        samples_analyzed=samples_saved,
        profile=aggregated,
    )


@router.get("/profile")
async def get_style_profile(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> StyleProfileResponse:
    """Get the current writing style profile for the authenticated user."""
    result = await db.execute(
        select(WritingStyleProfile).where(WritingStyleProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="No style profile found. Run calibration first.")

    return StyleProfileResponse(
        formality_score=profile.formality_score,
        warmth_score=profile.warmth_score,
        conciseness_score=profile.conciseness_score,
        avg_sentence_length=profile.avg_sentence_length,
        common_greetings=profile.common_greetings,
        common_closings=profile.common_closings,
        style_summary=profile.style_summary,
        sample_count=profile.sample_count,
    )


@router.patch("/profile")
async def update_style_profile(
    updates: dict[str, object],
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> StyleProfileResponse:
    """Manually adjust the writing style profile."""
    result = await db.execute(
        select(WritingStyleProfile).where(WritingStyleProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="No style profile found. Run calibration first.")

    allowed_fields = {
        "formality_score", "warmth_score", "conciseness_score",
        "avg_sentence_length", "common_greetings", "common_closings", "style_summary",
    }
    for key, value in updates.items():
        if key in allowed_fields:
            setattr(profile, key, value)

    return StyleProfileResponse(
        formality_score=profile.formality_score,
        warmth_score=profile.warmth_score,
        conciseness_score=profile.conciseness_score,
        avg_sentence_length=profile.avg_sentence_length,
        common_greetings=profile.common_greetings,
        common_closings=profile.common_closings,
        style_summary=profile.style_summary,
        sample_count=profile.sample_count,
    )
