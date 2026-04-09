"""AI draft generation endpoints (Layer 3)."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.config import settings
from app.database import get_db
from app.models.draft import GeneratedDraft
from app.models.persona import WritingStyleProfile
from app.models.policy import PolicyChunk, PolicyDocument

router = APIRouter()


class GenerateRequest(BaseModel):
    inbound_email_subject: str
    inbound_email_body: str
    inbound_email_from: str
    gmail_thread_id: str | None = None
    ticket_id: str | None = None


class GenerateResponse(BaseModel):
    draft_id: str
    draft_body: str
    confidence_score: float | None = None
    style_sources: list[str] = []
    policy_sources: list[str] = []


class DraftResponse(BaseModel):
    id: str
    draft_body: str
    confidence_score: float | None = None
    status: str
    style_sources: list[str] = []
    policy_sources: list[str] = []
    inbound_email_summary: str | None = None
    revision_count: int = 0


class DraftUpdateRequest(BaseModel):
    draft_body: str


DRAFT_GENERATION_PROMPT = """You are an AI email assistant for a university administrative staff member.
Generate a professional email reply based on the following context:

=== STAFF MEMBER'S WRITING STYLE ===
{style_context}

=== RELEVANT UNIVERSITY POLICIES ===
{policy_context}

=== INBOUND EMAIL ===
From: {from_email}
Subject: {subject}
Body:
{body}

=== INSTRUCTIONS ===
1. Write a reply that matches the staff member's writing style (tone, formality, greetings, closings)
2. Ensure the reply complies with university policies mentioned above
3. Be helpful and professional
4. If policies restrict what can be said, respect those restrictions
5. Include appropriate greeting and closing

Return a JSON object with:
- "draft_body": the full email reply text
- "confidence_score": float 0-1 (how confident you are in the appropriateness of this reply)
- "style_notes": brief note on which style elements you matched
- "policy_notes": brief note on which policies were relevant

Only return valid JSON, no other text."""


def _get_llm_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
    )


async def _get_style_context(user_id: uuid.UUID, db: AsyncSession) -> str:
    """Get the user's writing style profile as context string."""
    result = await db.execute(
        select(WritingStyleProfile).where(WritingStyleProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        return "No writing style profile available. Use a warm, professional tone."

    parts = []
    if profile.formality_score is not None:
        parts.append(f"Formality: {profile.formality_score:.1f}/1.0")
    if profile.warmth_score is not None:
        parts.append(f"Warmth: {profile.warmth_score:.1f}/1.0")
    if profile.conciseness_score is not None:
        parts.append(f"Conciseness: {profile.conciseness_score:.1f}/1.0")
    if profile.common_greetings:
        parts.append(f"Typical greetings: {', '.join(profile.common_greetings)}")
    if profile.common_closings:
        parts.append(f"Typical closings: {', '.join(profile.common_closings)}")
    if profile.style_summary:
        parts.append(f"Style summary: {profile.style_summary}")

    return "\n".join(parts) if parts else "No writing style profile available."


async def _get_policy_context(user_id: uuid.UUID, query: str, db: AsyncSession) -> tuple[str, list[str]]:
    """Get relevant policy chunks as context string. Returns (context, source_titles)."""
    query_words = query.lower().split()
    if not query_words:
        return "No specific policies found.", []

    result = await db.execute(
        select(PolicyChunk, PolicyDocument.title)
        .join(PolicyDocument, PolicyChunk.document_id == PolicyDocument.id)
        .where(PolicyChunk.user_id == user_id)
    )
    rows = result.all()

    scored: list[tuple[float, PolicyChunk, str]] = []
    for chunk, doc_title in rows:
        chunk_lower = chunk.chunk_text.lower()
        score = sum(1 for word in query_words if word in chunk_lower)
        if score > 0:
            scored.append((score, chunk, doc_title))

    scored.sort(key=lambda x: x[0], reverse=True)
    top_chunks = scored[:5]

    if not top_chunks:
        return "No specific policies found for this topic.", []

    context_parts = []
    source_titles = []
    for _, chunk, doc_title in top_chunks:
        context_parts.append(f"[{doc_title}]: {chunk.chunk_text}")
        if doc_title not in source_titles:
            source_titles.append(doc_title)

    return "\n\n".join(context_parts), source_titles


@router.post("/generate")
async def generate_draft(
    req: GenerateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> GenerateResponse:
    """Generate an AI draft reply for an inbound email.

    Combines the staff member's writing style (Layer 1) with relevant
    policy context (Layer 2) to produce a contextual draft.
    """
    # Gather context from Layer 1 and Layer 2
    style_context = await _get_style_context(user_id, db)
    policy_context, policy_sources = await _get_policy_context(
        user_id,
        f"{req.inbound_email_subject} {req.inbound_email_body}",
        db,
    )

    # Generate draft via LLM
    client = _get_llm_client()
    prompt = DRAFT_GENERATION_PROMPT.format(
        style_context=style_context,
        policy_context=policy_context,
        from_email=req.inbound_email_from,
        subject=req.inbound_email_subject,
        body=req.inbound_email_body,
    )

    response = await client.chat.completions.create(
        model=settings.openrouter_model,
        messages=[
            {"role": "system", "content": "You are a helpful email drafting assistant. Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        max_tokens=1000,
    )

    content = response.choices[0].message.content or "{}"
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[: content.rfind("```")]
    content = content.strip()

    try:
        result = json.loads(content)
    except json.JSONDecodeError:
        result = {"draft_body": content, "confidence_score": 0.5}

    draft_body = result.get("draft_body", content)
    confidence = result.get("confidence_score")
    style_notes = result.get("style_notes", "")

    # Save draft to DB
    draft = GeneratedDraft(
        user_id=user_id,
        ticket_id=req.ticket_id,
        gmail_thread_id=req.gmail_thread_id,
        inbound_email_summary=f"From: {req.inbound_email_from}\nSubject: {req.inbound_email_subject}",
        draft_body=draft_body,
        confidence_score=confidence,
        style_sources=[style_notes] if style_notes else [],
        policy_sources=policy_sources,
        status="pending",
    )
    db.add(draft)
    await db.flush()

    return GenerateResponse(
        draft_id=str(draft.id),
        draft_body=draft_body,
        confidence_score=confidence,
        style_sources=draft.style_sources,
        policy_sources=draft.policy_sources,
    )


@router.get("/{draft_id}")
async def get_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> DraftResponse:
    """Get a draft by ID."""
    result = await db.execute(
        select(GeneratedDraft).where(GeneratedDraft.id == draft_id, GeneratedDraft.user_id == user_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found.")

    return DraftResponse(
        id=str(draft.id),
        draft_body=draft.draft_body,
        confidence_score=draft.confidence_score,
        status=draft.status,
        style_sources=draft.style_sources,
        policy_sources=draft.policy_sources,
        inbound_email_summary=draft.inbound_email_summary,
        revision_count=draft.revision_count,
    )


@router.patch("/{draft_id}")
async def update_draft(
    draft_id: uuid.UUID,
    req: DraftUpdateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> DraftResponse:
    """Edit a draft before sending."""
    result = await db.execute(
        select(GeneratedDraft).where(GeneratedDraft.id == draft_id, GeneratedDraft.user_id == user_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found.")

    draft.draft_body = req.draft_body
    draft.revision_count += 1

    return DraftResponse(
        id=str(draft.id),
        draft_body=draft.draft_body,
        confidence_score=draft.confidence_score,
        status=draft.status,
        style_sources=draft.style_sources,
        policy_sources=draft.policy_sources,
        inbound_email_summary=draft.inbound_email_summary,
        revision_count=draft.revision_count,
    )


@router.post("/{draft_id}/approve")
async def approve_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> DraftResponse:
    """Approve a draft for sending."""
    result = await db.execute(
        select(GeneratedDraft).where(GeneratedDraft.id == draft_id, GeneratedDraft.user_id == user_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found.")

    draft.status = "approved"

    return DraftResponse(
        id=str(draft.id),
        draft_body=draft.draft_body,
        confidence_score=draft.confidence_score,
        status=draft.status,
        style_sources=draft.style_sources,
        policy_sources=draft.policy_sources,
        inbound_email_summary=draft.inbound_email_summary,
        revision_count=draft.revision_count,
    )


@router.post("/{draft_id}/reject")
async def reject_draft(
    draft_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> DraftResponse:
    """Reject a draft."""
    result = await db.execute(
        select(GeneratedDraft).where(GeneratedDraft.id == draft_id, GeneratedDraft.user_id == user_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found.")

    draft.status = "rejected"

    return DraftResponse(
        id=str(draft.id),
        draft_body=draft.draft_body,
        confidence_score=draft.confidence_score,
        status=draft.status,
        style_sources=draft.style_sources,
        policy_sources=draft.policy_sources,
        inbound_email_summary=draft.inbound_email_summary,
        revision_count=draft.revision_count,
    )
