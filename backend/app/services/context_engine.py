"""Context assembly for draft generation."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mvp import DraftResponse, DraftStatus, EmployeeProfile, PersonaProfile, PolicyChunk


def _extract_keywords(text: str) -> list[str]:
    candidates = re.findall(r"[a-zA-Z]{4,}", text.lower())
    seen: set[str] = set()
    ordered: list[str] = []
    for word in candidates:
        if word not in seen:
            ordered.append(word)
            seen.add(word)
        if len(ordered) >= 8:
            break
    return ordered


async def load_policy_context(db: AsyncSession, account_id: Any, query: str) -> dict[str, Any]:
    keywords = _extract_keywords(query)
    if not keywords:
        return {"summary": "No rulebook context available.", "sources": []}

    result = await db.execute(select(PolicyChunk).where(PolicyChunk.account_id == account_id).order_by(PolicyChunk.chunk_index))
    chunks = result.scalars().all()
    matches = [chunk for chunk in chunks if any(keyword in chunk.content.lower() for keyword in keywords)]
    if not matches:
        return {"summary": "No matching rulebook context found.", "sources": []}

    top = matches[:4]
    return {
        "summary": "\n\n".join(chunk.content for chunk in top),
        "sources": [str(chunk.rulebook_id) for chunk in top],
    }


async def load_example_context(db: AsyncSession, account_id: Any, user_id: Any, query: str) -> list[dict[str, str]]:
    keywords = _extract_keywords(query)
    if not keywords:
        return []

    result = await db.execute(
        select(DraftResponse)
        .where(
            DraftResponse.account_id == account_id,
            DraftResponse.user_id == user_id,
            DraftResponse.status == DraftStatus.sent,
        )
        .order_by(DraftResponse.sent_at.desc())
    )
    drafts = result.scalars().all()
    matches: list[dict[str, str]] = []
    for draft in drafts:
        haystack = f"{draft.subject}\n{draft.draft_body}".lower()
        if any(keyword in haystack for keyword in keywords):
            matches.append(
                {
                    "subject": draft.subject,
                    "response_excerpt": draft.draft_body[:500],
                }
            )
        if len(matches) >= 3:
            break
    return matches


def build_prompt(
    *,
    persona: PersonaProfile | None,
    employee_profile: EmployeeProfile | None,
    policy_summary: str,
    inbound_email: dict[str, Any],
    thread_messages: list[dict[str, Any]],
    examples: list[dict[str, str]],
) -> str:
    persona_block = "No persona available. Use a professional and helpful tone."
    if persona:
        persona_block = "\n".join(
            [
                f"Tone summary: {persona.tone_summary or 'N/A'}",
                f"Style summary: {persona.style_summary or 'N/A'}",
                f"Common greetings: {', '.join(persona.greeting_patterns) or 'N/A'}",
                f"Common sign-offs: {', '.join(persona.signoff_patterns) or 'N/A'}",
                f"Preferred phrases: {', '.join(persona.preferred_phrases) or 'N/A'}",
                f"Avoid phrases: {', '.join(persona.do_not_use_phrases) or 'N/A'}",
            ]
        )

    employee_block = "No employee role configured."
    if employee_profile:
        employee_block = "\n".join(
            [
                f"Title: {employee_profile.title}",
                f"Department: {employee_profile.department}",
                f"Office: {employee_profile.office_name}",
                f"Responsibilities: {employee_profile.responsibilities_summary}",
                f"Guidelines: {employee_profile.role_guidelines_summary}",
            ]
        )

    thread_block = "No thread history."
    if thread_messages:
        thread_block = "\n\n".join(
            f"From: {message.get('from', '')}\nTo: {message.get('to', '')}\nSubject: {message.get('subject', '')}\nBody:\n{message.get('body', '')[:1200]}"
            for message in thread_messages[-4:]
        )

    examples_block = "No similar prior responses."
    if examples:
        examples_block = "\n\n".join(
            f"Subject: {example['subject']}\nResponse excerpt:\n{example['response_excerpt']}"
            for example in examples
        )

    return f"""You are Relayr, an email drafting assistant.

PERSONA
{persona_block}

EMPLOYEE ROLE
{employee_block}

RULEBOOK CONTEXT
{policy_summary}

INBOUND EMAIL
From: {inbound_email.get('from', '')}
To: {inbound_email.get('to', '')}
Subject: {inbound_email.get('subject', '')}
Body:
{inbound_email.get('body', '')}

THREAD HISTORY
{thread_block}

SIMILAR PAST RESPONSES
{examples_block}

Write a compliant, helpful reply in the user's voice. Return valid JSON with:
- draft_body
- confidence_score
- rationale
Only return JSON."""
