"""Persona selection and generation services."""

from __future__ import annotations

import json
import uuid
from collections import Counter
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mvp import EmailDirection, GmailConnection, PersonaProfile, PersonaSourceEmail, PersonaStatus
from app.persona.llm_client import build_persona_profile
from app.services.gmail_service import fetch_full_message, get_active_connection, get_valid_token
from app.services.workspace import get_account_for_user

MAX_PERSONA_EMAILS = 30


def _length_preference(bodies: list[str]) -> str:
    if not bodies:
        return "medium"
    average = sum(len(body.split()) for body in bodies) / len(bodies)
    if average < 80:
        return "short"
    if average < 180:
        return "medium"
    return "long"


def _formatting_preferences(bodies: list[str]) -> dict[str, object]:
    bullet_like = sum(1 for body in bodies if "\n-" in body or "\n*" in body)
    paragraph_like = sum(1 for body in bodies if "\n\n" in body)
    return {
        "uses_bullets": bullet_like > 0,
        "multi_paragraph": paragraph_like > 0,
    }


async def _get_or_create_persona(
    db: AsyncSession,
    *,
    account_id: uuid.UUID,
    user_id: uuid.UUID,
    connection: GmailConnection,
) -> PersonaProfile:
    result = await db.execute(
        select(PersonaProfile)
        .where(
            PersonaProfile.account_id == account_id,
            PersonaProfile.user_id == user_id,
            PersonaProfile.gmail_connection_id == connection.id,
        )
        .order_by(PersonaProfile.updated_at.desc())
    )
    persona = result.scalar_one_or_none()
    if persona:
        return persona

    persona = PersonaProfile(
        account_id=account_id,
        user_id=user_id,
        gmail_connection_id=connection.id,
        name="Primary Persona",
        greeting_patterns=[],
        signoff_patterns=[],
        formatting_preferences={},
        do_not_use_phrases=[],
        preferred_phrases=[],
        source_email_count=0,
        status=PersonaStatus.draft,
    )
    db.add(persona)
    await db.flush()
    return persona


async def list_selectable_messages(db: AsyncSession, user_id: uuid.UUID, max_results: int = 30) -> dict[str, object]:
    connection, token = await get_valid_token(db, user_id)
    from app.services.gmail_service import fetch_messages

    messages = await fetch_messages(token, max_results=max_results, query="in:sent", label_id="SENT")
    return {
        "connection_id": str(connection.id),
        "messages": messages,
        "max_selection": MAX_PERSONA_EMAILS,
    }


async def save_persona_selection(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    selected_messages: list[dict[str, Any]],
    persona_name: str | None = None,
) -> dict[str, object]:
    if not selected_messages:
        raise ValueError("Select at least one email.")
    if len(selected_messages) > MAX_PERSONA_EMAILS:
        raise ValueError(f"You can select up to {MAX_PERSONA_EMAILS} emails.")

    account = await get_account_for_user(db, user_id)
    connection = await get_active_connection(db, user_id)
    persona = await _get_or_create_persona(db, account_id=account.id, user_id=user_id, connection=connection)
    if persona_name:
        persona.name = persona_name

    await db.execute(delete(PersonaSourceEmail).where(PersonaSourceEmail.persona_profile_id == persona.id))
    for message in selected_messages:
        gmail_message_id = str(message.get("gmail_message_id") or message.get("id") or "").strip()
        if not gmail_message_id:
            raise ValueError("Each selected email must include gmail_message_id.")
        direction = str(message.get("direction") or "sent").lower()
        persona_source = PersonaSourceEmail(
            persona_profile_id=persona.id,
            gmail_connection_id=connection.id,
            gmail_message_id=gmail_message_id,
            gmail_thread_id=str(message.get("gmail_thread_id") or message.get("thread_id") or "") or None,
            direction=EmailDirection.sent if direction != "received" else EmailDirection.received,
            from_email=str(message.get("from_email") or message.get("from") or "") or None,
            to_emails=list(message.get("to_emails") or []),
            subject=str(message.get("subject") or "") or None,
            snippet=str(message.get("snippet") or "") or None,
            sent_at=message.get("sent_at"),
            used_for_persona=True,
        )
        db.add(persona_source)

    persona.status = PersonaStatus.draft
    persona.source_email_count = len(selected_messages)
    await db.flush()
    return {
        "persona_profile_id": str(persona.id),
        "source_email_count": persona.source_email_count,
        "status": persona.status.value,
    }


async def build_persona(db: AsyncSession, *, user_id: uuid.UUID, persona_profile_id: uuid.UUID | None = None) -> dict[str, object]:
    account = await get_account_for_user(db, user_id)
    connection, token = await get_valid_token(db, user_id)

    query = select(PersonaProfile).where(
        PersonaProfile.account_id == account.id,
        PersonaProfile.user_id == user_id,
        PersonaProfile.gmail_connection_id == connection.id,
    )
    if persona_profile_id:
        query = query.where(PersonaProfile.id == persona_profile_id)
    query = query.order_by(PersonaProfile.updated_at.desc())

    result = await db.execute(query)
    persona = result.scalar_one_or_none()
    if not persona:
        raise ValueError("No persona selection found. Save selected emails first.")

    source_result = await db.execute(
        select(PersonaSourceEmail)
        .where(PersonaSourceEmail.persona_profile_id == persona.id)
        .order_by(PersonaSourceEmail.created_at.asc())
    )
    sources = source_result.scalars().all()
    if not sources:
        raise ValueError("No source emails selected for persona generation.")

    fetched_messages: list[dict[str, object]] = []
    for source in sources:
        fetched_messages.append(await fetch_full_message(token, source.gmail_message_id))

    if not fetched_messages:
        raise ValueError("Selected emails could not be accessed from Gmail.")

    llm_result = await build_persona_profile(
        [
            {
                "subject": str(message.get("subject", "")),
                "body": str(message.get("body", "")),
                "snippet": str(message.get("snippet", "")),
            }
            for message in fetched_messages
        ]
    )

    greetings = [item for item in llm_result.get("greeting_patterns", []) if isinstance(item, str)]
    signoffs = [item for item in llm_result.get("signoff_patterns", []) if isinstance(item, str)]
    preferred = [item for item in llm_result.get("preferred_phrases", []) if isinstance(item, str)]
    avoid = [item for item in llm_result.get("do_not_use_phrases", []) if isinstance(item, str)]
    bodies = [str(message.get("body", "")) for message in fetched_messages if str(message.get("body", "")).strip()]

    if not greetings:
        greetings = [item for item, _ in Counter(greetings).most_common(3)]
    if not signoffs:
        signoffs = [item for item, _ in Counter(signoffs).most_common(3)]

    persona.tone_summary = str(llm_result.get("tone_summary", ""))
    persona.style_summary = str(llm_result.get("style_summary", ""))
    persona.greeting_patterns = greetings[:5]
    persona.signoff_patterns = signoffs[:5]
    persona.length_preference = str(llm_result.get("length_preference") or _length_preference(bodies))
    persona.formatting_preferences = (
        llm_result.get("formatting_preferences")
        if isinstance(llm_result.get("formatting_preferences"), dict)
        else _formatting_preferences(bodies)
    )
    persona.do_not_use_phrases = avoid[:10]
    persona.preferred_phrases = preferred[:10]
    persona.raw_summary = str(llm_result.get("raw_summary") or json.dumps(llm_result))
    persona.source_email_count = len(fetched_messages)
    persona.last_built_at = datetime.now(UTC)
    persona.status = PersonaStatus.ready
    await db.flush()

    return {
        "persona_profile_id": str(persona.id),
        "status": persona.status.value,
        "source_email_count": persona.source_email_count,
        "tone_summary": persona.tone_summary,
        "style_summary": persona.style_summary,
        "greeting_patterns": persona.greeting_patterns,
        "signoff_patterns": persona.signoff_patterns,
        "length_preference": persona.length_preference,
        "formatting_preferences": persona.formatting_preferences,
        "preferred_phrases": persona.preferred_phrases,
        "do_not_use_phrases": persona.do_not_use_phrases,
    }


async def get_latest_persona(db: AsyncSession, *, user_id: uuid.UUID) -> PersonaProfile | None:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(PersonaProfile)
        .where(PersonaProfile.account_id == account.id, PersonaProfile.user_id == user_id)
        .order_by(PersonaProfile.updated_at.desc())
    )
    return result.scalar_one_or_none()
