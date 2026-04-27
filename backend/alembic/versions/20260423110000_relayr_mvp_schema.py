"""relayr mvp schema

Revision ID: 20260423110000
Revises:
Create Date: 2026-04-23 11:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "20260423110000"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


account_role = postgresql.ENUM("owner", "admin", "manager", "member", name="account_role")
persona_status = postgresql.ENUM("draft", "ready", "archived", name="persona_status")
draft_status = postgresql.ENUM("draft", "approved", "sent", "failed", name="draft_status")
rulebook_status = postgresql.ENUM("uploaded", "processed", "failed", name="rulebook_status")
document_type = postgresql.ENUM("policy", "rulebook", "guide", "template", name="document_type")
email_direction = postgresql.ENUM("sent", "received", name="email_direction")


def upgrade() -> None:
    bind = op.get_bind()
    account_role.create(bind, checkfirst=True)
    persona_status.create(bind, checkfirst=True)
    draft_status.create(bind, checkfirst=True)
    rulebook_status.create(bind, checkfirst=True)
    document_type.create(bind, checkfirst=True)
    email_direction.create(bind, checkfirst=True)

    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("ix_accounts_slug", "accounts", ["slug"], unique=True)

    op.create_table(
        "account_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", account_role, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "user_id", name="uq_account_members_account_user"),
    )
    op.create_index("ix_account_members_user_id", "account_members", ["user_id"], unique=False)

    op.create_table(
        "gmail_connections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_email", sa.String(length=320), nullable=False),
        sa.Column("google_subject_id", sa.String(length=255), nullable=True),
        sa.Column("access_token_encrypted", sa.Text(), nullable=False),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scopes", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_gmail_connections_user_id", "gmail_connections", ["user_id"], unique=False)

    op.create_table(
        "employee_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("department", sa.String(length=255), nullable=False),
        sa.Column("office_name", sa.String(length=255), nullable=False),
        sa.Column("responsibilities_summary", sa.Text(), nullable=False),
        sa.Column("role_guidelines_summary", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "user_id", name="uq_employee_profiles_account_user"),
    )
    op.create_index("ix_employee_profiles_user_id", "employee_profiles", ["user_id"], unique=False)

    op.create_table(
        "persona_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("tone_summary", sa.Text(), nullable=True),
        sa.Column("style_summary", sa.Text(), nullable=True),
        sa.Column("greeting_patterns", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("signoff_patterns", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("length_preference", sa.String(length=50), nullable=True),
        sa.Column("formatting_preferences", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("do_not_use_phrases", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("preferred_phrases", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("raw_summary", sa.Text(), nullable=True),
        sa.Column("source_email_count", sa.Integer(), nullable=False),
        sa.Column("status", persona_status, nullable=False),
        sa.Column("last_built_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["gmail_connection_id"], ["gmail_connections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_persona_profiles_user_id", "persona_profiles", ["user_id"], unique=False)

    op.create_table(
        "persona_source_emails",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("persona_profile_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_message_id", sa.String(length=255), nullable=False),
        sa.Column("gmail_thread_id", sa.String(length=255), nullable=True),
        sa.Column("direction", email_direction, nullable=False),
        sa.Column("from_email", sa.String(length=320), nullable=True),
        sa.Column("to_emails", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("subject", sa.Text(), nullable=True),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_for_persona", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["gmail_connection_id"], ["gmail_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["persona_profile_id"], ["persona_profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("persona_profile_id", "gmail_message_id", name="uq_persona_source_emails_persona_message"),
    )

    op.create_table(
        "institution_rulebooks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("document_type", document_type, nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=False),
        sa.Column("storage_path", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("status", rulebook_status, nullable=False),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "rulebook_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("rulebook_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["rulebook_id"], ["institution_rulebooks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "draft_responses",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("gmail_connection_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source_gmail_message_id", sa.String(length=255), nullable=False),
        sa.Column("source_gmail_thread_id", sa.String(length=255), nullable=True),
        sa.Column("recipient_email", sa.String(length=320), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("draft_body", sa.Text(), nullable=False),
        sa.Column("status", draft_status, nullable=False),
        sa.Column("generation_context", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("persona_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("employee_profile_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["employee_profile_id"], ["employee_profiles.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["gmail_connection_id"], ["gmail_connections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["persona_profile_id"], ["persona_profiles.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_draft_responses_user_id", "draft_responses", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_draft_responses_user_id", table_name="draft_responses")
    op.drop_table("draft_responses")
    op.drop_table("rulebook_chunks")
    op.drop_table("institution_rulebooks")
    op.drop_table("persona_source_emails")
    op.drop_index("ix_persona_profiles_user_id", table_name="persona_profiles")
    op.drop_table("persona_profiles")
    op.drop_index("ix_employee_profiles_user_id", table_name="employee_profiles")
    op.drop_table("employee_profiles")
    op.drop_index("ix_gmail_connections_user_id", table_name="gmail_connections")
    op.drop_table("gmail_connections")
    op.drop_index("ix_account_members_user_id", table_name="account_members")
    op.drop_table("account_members")
    op.drop_index("ix_accounts_slug", table_name="accounts")
    op.drop_table("accounts")

    bind = op.get_bind()
    email_direction.drop(bind, checkfirst=True)
    document_type.drop(bind, checkfirst=True)
    rulebook_status.drop(bind, checkfirst=True)
    draft_status.drop(bind, checkfirst=True)
    persona_status.drop(bind, checkfirst=True)
    account_role.drop(bind, checkfirst=True)
