"""Persona and writing style models for Layer 1."""

import uuid

from sqlalchemy import Float, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Persona(Base, TimestampMixin):
    """Mirrors existing Supabase personas table — user-configured persona settings."""

    __tablename__ = "personas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    role_title: Mapped[str] = mapped_column(Text, nullable=False, default="")
    authority_level: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    tone_default: Mapped[str] = mapped_column(Text, nullable=False, default="warm-professional")
    signature_block: Mapped[str] = mapped_column(Text, nullable=False, default="")
    communication_structure: Mapped[str] = mapped_column(Text, nullable=False, default="")
    can_do: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    cannot_do: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    approved_phrases: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    safe_language_templates: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    formality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    warmth_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    conciseness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    office_id: Mapped[str | None] = mapped_column(Text, nullable=True)


class WritingStyleProfile(Base, TimestampMixin):
    """Layer 1: Learned writing style profile from email analysis."""

    __tablename__ = "writing_style_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    formality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    warmth_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    conciseness_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    avg_sentence_length: Mapped[float | None] = mapped_column(Float, nullable=True)
    common_greetings: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    common_closings: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    style_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    sample_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EmailStyleSample(Base, TimestampMixin):
    """Metadata for emails used in style calibration (no full body stored for privacy)."""

    __tablename__ = "email_style_samples"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    gmail_message_id: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_features_json: Mapped[str | None] = mapped_column(Text, nullable=True)
