"""Rulebook ingestion and retrieval hooks."""

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.models.mvp import DocumentType, PolicyChunk, PolicyDocument, RulebookStatus
from app.services.workspace import get_account_for_user

router = APIRouter()


class IngestRequest(BaseModel):
    title: str
    raw_text: str
    file_name: str = "manual-upload.txt"
    mime_type: str = "text/plain"
    document_type: DocumentType = DocumentType.rulebook


class PolicySearchRequest(BaseModel):
    query: str
    top_k: int = 5


def _chunk_text(text: str, size: int = 500) -> list[str]:
    words = text.split()
    chunks: list[str] = []
    for idx in range(0, len(words), size):
        chunks.append(" ".join(words[idx : idx + size]))
    return chunks


def _summary(text: str) -> str:
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    return " ".join(sentences[:3])[:1200]


@router.post("/ingest")
async def ingest_policy(
    req: IngestRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")

    account = await get_account_for_user(db, user_id)
    document = PolicyDocument(
        account_id=account.id,
        title=req.title,
        document_type=req.document_type,
        file_name=req.file_name,
        storage_path=f"manual://{req.file_name}",
        mime_type=req.mime_type,
        summary=_summary(req.raw_text),
        status=RulebookStatus.processed,
        created_by_user_id=user_id,
        extracted_text=req.raw_text,
    )
    db.add(document)
    await db.flush()

    for index, chunk in enumerate(_chunk_text(req.raw_text)):
        db.add(
            PolicyChunk(
                rulebook_id=document.id,
                account_id=account.id,
                chunk_index=index,
                content=chunk,
                chunk_metadata={"source": req.file_name},
            )
        )

    await db.flush()
    return {
        "document_id": str(document.id),
        "title": document.title,
        "status": document.status.value,
    }


@router.get("/documents")
async def list_documents(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(PolicyDocument).where(PolicyDocument.account_id == account.id).order_by(PolicyDocument.created_at.desc())
    )
    documents = result.scalars().all()
    return [
        {
            "id": str(document.id),
            "title": document.title,
            "document_type": document.document_type.value,
            "status": document.status.value,
            "summary": document.summary,
            "created_at": document.created_at.isoformat() if document.created_at else None,
        }
        for document in documents
    ]


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(PolicyDocument).where(PolicyDocument.id == document_id, PolicyDocument.account_id == account.id)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found.")

    await db.execute(delete(PolicyChunk).where(PolicyChunk.rulebook_id == document.id))
    await db.delete(document)
    return {"deleted": True}


@router.post("/search")
async def search_policy(
    req: PolicySearchRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, object]]:
    account = await get_account_for_user(db, user_id)
    query_words = [word for word in req.query.lower().split() if word]
    if not query_words:
        return []

    result = await db.execute(
        select(PolicyChunk).where(PolicyChunk.account_id == account.id).order_by(PolicyChunk.chunk_index.asc())
    )
    chunks = result.scalars().all()

    scored: list[tuple[int, PolicyChunk]] = []
    for chunk in chunks:
        score = sum(1 for word in query_words if word in chunk.content.lower())
        if score > 0:
            scored.append((score, chunk))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [
        {
            "rulebook_id": str(chunk.rulebook_id),
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "metadata": chunk.chunk_metadata,
        }
        for _, chunk in scored[: req.top_k]
    ]
