"""Workspace and account resolution helpers."""

from __future__ import annotations

import re
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.mvp import AccountMember, AccountRole, Accounts


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "relayr-workspace"


async def get_account_for_user(db: AsyncSession, user_id: uuid.UUID) -> Accounts:
    result = await db.execute(
        select(Accounts)
        .join(AccountMember, AccountMember.account_id == Accounts.id)
        .where(AccountMember.user_id == user_id)
        .order_by(Accounts.created_at.asc())
    )
    account = result.scalar_one_or_none()
    if account:
        return account
    return await ensure_default_account(db, user_id)


async def ensure_default_account(db: AsyncSession, user_id: uuid.UUID) -> Accounts:
    existing = await db.execute(
        select(Accounts)
        .join(AccountMember, AccountMember.account_id == Accounts.id)
        .where(AccountMember.user_id == user_id)
        .order_by(Accounts.created_at.asc())
    )
    account = existing.scalar_one_or_none()
    if account:
        return account

    base_slug = _slugify(f"relayr-{str(user_id)[:8]}")
    slug = base_slug
    suffix = 1
    while True:
        slug_result = await db.execute(select(Accounts).where(Accounts.slug == slug))
        if slug_result.scalar_one_or_none() is None:
            break
        suffix += 1
        slug = f"{base_slug}-{suffix}"

    account = Accounts(
        name="Relayr Workspace",
        slug=slug,
        created_by_user_id=user_id,
    )
    db.add(account)
    await db.flush()

    db.add(
        AccountMember(
            account_id=account.id,
            user_id=user_id,
            role=AccountRole.owner,
        )
    )
    await db.flush()
    return account
