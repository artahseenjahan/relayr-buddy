"""Generated draft models for Layer 3."""

import uuid

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GeneratedDraft(Base, TimestampMixin):
    """AI-generated email draft with confidence scoring and source tracking."""

    __tablename__ = "generated_drafts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    ticket_id: Mapped[str | None] = mapped_column(String, nullable=True)
    gmail_thread_id: Mapped[str | None] = mapped_column(String, nullable=True)
    inbound_email_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_body: Mapped[str] = mapped_column(Text, nullable=False)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    style_sources: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    policy_sources: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    revision_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
