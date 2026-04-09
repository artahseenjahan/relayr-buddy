"""Policy/rulebook ingestion and RAG retrieval endpoints (Layer 2)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.models.policy import PolicyChunk, PolicyDocument

router = APIRouter()


class IngestRequest(BaseModel):
    title: str
    raw_text: str
    source_type: str = "manual"
    office_id: str | None = None


class IngestResponse(BaseModel):
    document_id: str
    title: str
    chunk_count: int


class PolicyDocumentResponse(BaseModel):
    id: str
    title: str
    source_type: str
    chunk_count: int
    office_id: str | None = None


class PolicySearchRequest(BaseModel):
    query: str
    top_k: int = 5


class PolicySearchResult(BaseModel):
    chunk_text: str
    document_title: str
    chunk_index: int


def _chunk_text(text: str, max_tokens: int = 500) -> list[str]:
    """Split text into chunks of approximately max_tokens words."""
    words = text.split()
    chunks: list[str] = []
    current_chunk: list[str] = []
    current_count = 0

    for word in words:
        current_chunk.append(word)
        current_count += 1
        if current_count >= max_tokens:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_count = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


@router.post("/ingest")
async def ingest_policy(
    req: IngestRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> IngestResponse:
    """Upload, chunk, and store a policy document for RAG retrieval."""
    if not req.raw_text.strip():
        raise HTTPException(status_code=400, detail="Document text cannot be empty.")

    # Create the document record
    doc = PolicyDocument(
        user_id=user_id,
        title=req.title,
        source_type=req.source_type,
        raw_text=req.raw_text,
        office_id=req.office_id,
    )
    db.add(doc)
    await db.flush()  # Get the doc ID

    # Chunk the text
    chunks = _chunk_text(req.raw_text)
    for i, chunk_text in enumerate(chunks):
        chunk = PolicyChunk(
            document_id=doc.id,
            user_id=user_id,
            chunk_text=chunk_text,
            chunk_index=i,
            token_count=len(chunk_text.split()),
        )
        db.add(chunk)

    doc.chunk_count = len(chunks)

    return IngestResponse(
        document_id=str(doc.id),
        title=doc.title,
        chunk_count=len(chunks),
    )


@router.get("/documents")
async def list_documents(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[PolicyDocumentResponse]:
    """List all policy documents for the authenticated user."""
    result = await db.execute(
        select(PolicyDocument).where(PolicyDocument.user_id == user_id).order_by(PolicyDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return [
        PolicyDocumentResponse(
            id=str(d.id),
            title=d.title,
            source_type=d.source_type,
            chunk_count=d.chunk_count,
            office_id=d.office_id,
        )
        for d in docs
    ]


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Delete a policy document and its chunks."""
    result = await db.execute(
        select(PolicyDocument).where(PolicyDocument.id == document_id, PolicyDocument.user_id == user_id)
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Delete chunks first
    await db.execute(delete(PolicyChunk).where(PolicyChunk.document_id == document_id))
    await db.delete(doc)

    return {"deleted": True}


@router.post("/search")
async def search_policy(
    req: PolicySearchRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[PolicySearchResult]:
    """Search policy documents using keyword matching.

    Note: This is a basic keyword search implementation.
    Full vector similarity search will be enabled once pgvector
    embeddings are generated for each chunk.
    """
    query_words = req.query.lower().split()
    if not query_words:
        return []

    # Basic keyword search across chunks belonging to this user
    result = await db.execute(
        select(PolicyChunk, PolicyDocument.title)
        .join(PolicyDocument, PolicyChunk.document_id == PolicyDocument.id)
        .where(PolicyChunk.user_id == user_id)
        .order_by(PolicyChunk.chunk_index)
    )
    rows = result.all()

    # Score chunks by keyword overlap
    scored: list[tuple[float, PolicyChunk, str]] = []
    for chunk, doc_title in rows:
        chunk_lower = chunk.chunk_text.lower()
        score = sum(1 for word in query_words if word in chunk_lower)
        if score > 0:
            scored.append((score, chunk, doc_title))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        PolicySearchResult(
            chunk_text=chunk.chunk_text,
            document_title=doc_title,
            chunk_index=chunk.chunk_index,
        )
        for _, chunk, doc_title in scored[: req.top_k]
    ]
