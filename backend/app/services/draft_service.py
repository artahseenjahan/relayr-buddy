"""Draft generation and lifecycle service."""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime
from typing import Any

from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.mvp import DraftResponse, DraftStatus, EmployeeProfile, PersonaProfile
from app.services.context_engine import build_prompt, load_example_context, load_policy_context
from app.services.gmail_service import fetch_full_message, fetch_thread, get_valid_token, send_email
from app.services.workspace import get_account_for_user


def _get_llm_client() -> AsyncOpenAI:
    if not settings.openrouter_api_key:
        raise ValueError("OpenRouter is not configured. Set OPENROUTER_API_KEY.")
    return AsyncOpenAI(base_url="https://openrouter.ai/api/v1", api_key=settings.openrouter_api_key)


async def _resolve_optional_profiles(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    account_id: uuid.UUID,
    persona_profile_id: uuid.UUID | None,
    employee_profile_id: uuid.UUID | None,
) -> tuple[PersonaProfile | None, EmployeeProfile | None]:
    persona: PersonaProfile | None = None
    employee_profile: EmployeeProfile | None = None

    if persona_profile_id:
        result = await db.execute(
            select(PersonaProfile).where(PersonaProfile.id == persona_profile_id, PersonaProfile.user_id == user_id)
        )
        persona = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(PersonaProfile)
            .where(PersonaProfile.account_id == account_id, PersonaProfile.user_id == user_id)
            .order_by(PersonaProfile.updated_at.desc())
        )
        persona = result.scalar_one_or_none()

    if employee_profile_id:
        result = await db.execute(
            select(EmployeeProfile).where(EmployeeProfile.id == employee_profile_id, EmployeeProfile.user_id == user_id)
        )
        employee_profile = result.scalar_one_or_none()
    else:
        result = await db.execute(
            select(EmployeeProfile)
            .where(EmployeeProfile.account_id == account_id, EmployeeProfile.user_id == user_id)
            .order_by(EmployeeProfile.updated_at.desc())
        )
        employee_profile = result.scalar_one_or_none()

    return persona, employee_profile


async def generate_draft(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    source_gmail_message_id: str,
    persona_profile_id: uuid.UUID | None = None,
    employee_profile_id: uuid.UUID | None = None,
) -> dict[str, Any]:
    account = await get_account_for_user(db, user_id)
    connection, token = await get_valid_token(db, user_id)
    inbound_email = await fetch_full_message(token, source_gmail_message_id)
    thread_messages: list[dict[str, Any]] = []
    if inbound_email.get("thread_id"):
        thread = await fetch_thread(token, str(inbound_email["thread_id"]))
        thread_messages = list(thread.get("messages", []))

    persona, employee_profile = await _resolve_optional_profiles(
        db,
        user_id=user_id,
        account_id=account.id,
        persona_profile_id=persona_profile_id,
        employee_profile_id=employee_profile_id,
    )
    policy_context = await load_policy_context(
        db,
        account.id,
        f"{inbound_email.get('subject', '')} {inbound_email.get('body', '')}",
    )
    examples = await load_example_context(
        db,
        account.id,
        user_id,
        f"{inbound_email.get('subject', '')} {inbound_email.get('body', '')}",
    )

    prompt = build_prompt(
        persona=persona,
        employee_profile=employee_profile,
        policy_summary=str(policy_context["summary"]),
        inbound_email=inbound_email,
        thread_messages=thread_messages,
        examples=examples,
    )

    client = _get_llm_client()
    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": "You write helpful email drafts. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.4,
        max_tokens=1200,
    )
    content = (response.choices[0].message.content or "{}").strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[: content.rfind("```")]
    content = content.strip()
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError:
        parsed = {"draft_body": content, "confidence_score": 0.4, "rationale": "Non-JSON model response"}

    recipient_email = str(inbound_email.get("from", ""))
    subject = str(inbound_email.get("subject", "(no subject)"))
    draft_body = str(parsed.get("draft_body", "")).strip()
    if not draft_body:
        raise ValueError("Draft generation returned an empty draft.")

    draft = DraftResponse(
        account_id=account.id,
        user_id=user_id,
        gmail_connection_id=connection.id,
        source_gmail_message_id=source_gmail_message_id,
        source_gmail_thread_id=str(inbound_email.get("thread_id", "")) or None,
        recipient_email=recipient_email,
        subject=subject,
        draft_body=draft_body,
        status=DraftStatus.draft,
        generation_context={
            "persona_profile_id": str(persona.id) if persona else None,
            "employee_profile_id": str(employee_profile.id) if employee_profile else None,
            "policy_sources": policy_context["sources"],
            "similar_examples": examples,
            "confidence_score": parsed.get("confidence_score"),
            "rationale": parsed.get("rationale"),
        },
        persona_profile_id=persona.id if persona else None,
        employee_profile_id=employee_profile.id if employee_profile else None,
    )
    db.add(draft)
    await db.flush()
    return serialize_draft(draft)


def serialize_draft(draft: DraftResponse) -> dict[str, Any]:
    return {
        "id": str(draft.id),
        "account_id": str(draft.account_id),
        "user_id": str(draft.user_id),
        "gmail_connection_id": str(draft.gmail_connection_id),
        "source_gmail_message_id": draft.source_gmail_message_id,
        "source_gmail_thread_id": draft.source_gmail_thread_id,
        "recipient_email": draft.recipient_email,
        "subject": draft.subject,
        "draft_body": draft.draft_body,
        "status": draft.status.value,
        "generation_context": draft.generation_context,
        "persona_profile_id": str(draft.persona_profile_id) if draft.persona_profile_id else None,
        "employee_profile_id": str(draft.employee_profile_id) if draft.employee_profile_id else None,
        "approved_at": draft.approved_at.isoformat() if draft.approved_at else None,
        "sent_at": draft.sent_at.isoformat() if draft.sent_at else None,
        "error_message": draft.error_message,
        "created_at": draft.created_at.isoformat() if draft.created_at else None,
        "updated_at": draft.updated_at.isoformat() if draft.updated_at else None,
    }


async def get_draft_for_user(db: AsyncSession, *, user_id: uuid.UUID, draft_id: uuid.UUID) -> DraftResponse:
    result = await db.execute(select(DraftResponse).where(DraftResponse.id == draft_id, DraftResponse.user_id == user_id))
    draft = result.scalar_one_or_none()
    if not draft:
        raise ValueError("Draft not found.")
    return draft


async def approve_draft(db: AsyncSession, *, user_id: uuid.UUID, draft_id: uuid.UUID) -> dict[str, Any]:
    draft = await get_draft_for_user(db, user_id=user_id, draft_id=draft_id)
    draft.status = DraftStatus.approved
    draft.approved_at = datetime.now(UTC)
    draft.error_message = None
    await db.flush()
    return serialize_draft(draft)


async def update_draft_body(db: AsyncSession, *, user_id: uuid.UUID, draft_id: uuid.UUID, draft_body: str) -> dict[str, Any]:
    draft = await get_draft_for_user(db, user_id=user_id, draft_id=draft_id)
    draft.draft_body = draft_body
    await db.flush()
    return serialize_draft(draft)


async def send_draft(db: AsyncSession, *, user_id: uuid.UUID, draft_id: uuid.UUID) -> dict[str, Any]:
    draft = await get_draft_for_user(db, user_id=user_id, draft_id=draft_id)
    if draft.status == DraftStatus.sent:
        raise ValueError("Draft was already sent.")
    if draft.status != DraftStatus.approved:
        raise ValueError("Draft must be approved before sending.")

    _, token = await get_valid_token(db, user_id)
    try:
        await send_email(
            token,
            to=draft.recipient_email,
            subject=draft.subject,
            body=draft.draft_body,
            thread_id=draft.source_gmail_thread_id,
        )
    except Exception as exc:
        draft.status = DraftStatus.failed
        draft.error_message = str(exc)
        await db.flush()
        return serialize_draft(draft)

    draft.status = DraftStatus.sent
    draft.sent_at = datetime.now(UTC)
    draft.error_message = None
    await db.flush()
    return serialize_draft(draft)
