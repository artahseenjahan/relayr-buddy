"""Core Relayr MVP models."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class AccountRole(str, enum.Enum):
    owner = "owner"
    admin = "admin"
    manager = "manager"
    member = "member"


class PersonaStatus(str, enum.Enum):
    draft = "draft"
    ready = "ready"
    archived = "archived"


class DraftStatus(str, enum.Enum):
    draft = "draft"
    approved = "approved"
    sent = "sent"
    failed = "failed"


class RulebookStatus(str, enum.Enum):
    uploaded = "uploaded"
    processed = "processed"
    failed = "failed"


class DocumentType(str, enum.Enum):
    policy = "policy"
    rulebook = "rulebook"
    guide = "guide"
    template = "template"


class EmailDirection(str, enum.Enum):
    sent = "sent"
    received = "received"


class Accounts(Base, TimestampMixin):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)


class AccountMember(Base):
    __tablename__ = "account_members"
    __table_args__ = (UniqueConstraint("account_id", "user_id", name="uq_account_members_account_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    role: Mapped[AccountRole] = mapped_column(Enum(AccountRole, name="account_role"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class GmailConnection(Base, TimestampMixin):
    __tablename__ = "gmail_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    gmail_email: Mapped[str] = mapped_column(String(320), nullable=False)
    google_subject_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expiry: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scopes: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class EmployeeProfile(Base, TimestampMixin):
    __tablename__ = "employee_profiles"
    __table_args__ = (UniqueConstraint("account_id", "user_id", name="uq_employee_profiles_account_user"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department: Mapped[str] = mapped_column(String(255), nullable=False)
    office_name: Mapped[str] = mapped_column(String(255), nullable=False)
    responsibilities_summary: Mapped[str] = mapped_column(Text, nullable=False)
    role_guidelines_summary: Mapped[str] = mapped_column(Text, nullable=False)


class PersonaProfile(Base, TimestampMixin):
    __tablename__ = "persona_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    gmail_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gmail_connections.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tone_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    style_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    greeting_patterns: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    signoff_patterns: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    length_preference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    formatting_preferences: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    do_not_use_phrases: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    preferred_phrases: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    raw_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_email_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[PersonaStatus] = mapped_column(Enum(PersonaStatus, name="persona_status"), nullable=False)
    last_built_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PersonaSourceEmail(Base):
    __tablename__ = "persona_source_emails"
    __table_args__ = (
        UniqueConstraint(
            "persona_profile_id",
            "gmail_message_id",
            name="uq_persona_source_emails_persona_message",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("persona_profiles.id", ondelete="CASCADE"), nullable=False
    )
    gmail_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gmail_connections.id", ondelete="CASCADE"), nullable=False
    )
    gmail_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    direction: Mapped[EmailDirection] = mapped_column(Enum(EmailDirection, name="email_direction"), nullable=False)
    from_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    to_emails: Mapped[list[str]] = mapped_column(ARRAY(Text), nullable=False, default=list)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_for_persona: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class PolicyDocument(Base, TimestampMixin):
    __tablename__ = "institution_rulebooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    document_type: Mapped[DocumentType] = mapped_column(Enum(DocumentType, name="document_type"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[RulebookStatus] = mapped_column(Enum(RulebookStatus, name="rulebook_status"), nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)


class PolicyChunk(Base):
    __tablename__ = "rulebook_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rulebook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institution_rulebooks.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_metadata: Mapped[dict[str, object]] = mapped_column("metadata", JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class DraftResponse(Base, TimestampMixin):
    __tablename__ = "draft_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    gmail_connection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gmail_connections.id", ondelete="CASCADE"), nullable=False
    )
    source_gmail_message_id: Mapped[str] = mapped_column(String(255), nullable=False)
    source_gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    draft_body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[DraftStatus] = mapped_column(Enum(DraftStatus, name="draft_status"), nullable=False)
    generation_context: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    persona_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("persona_profiles.id", ondelete="SET NULL"), nullable=True
    )
    employee_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employee_profiles.id", ondelete="SET NULL"), nullable=True
    )
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
