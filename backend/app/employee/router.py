"""Employee profile CRUD for role-based context."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.models.mvp import EmployeeProfile
from app.services.workspace import get_account_for_user

router = APIRouter()


class EmployeeProfileRequest(BaseModel):
    title: str
    department: str
    office_name: str
    responsibilities_summary: str
    role_guidelines_summary: str


def _serialize(profile: EmployeeProfile) -> dict[str, object]:
    return {
        "id": str(profile.id),
        "account_id": str(profile.account_id),
        "user_id": str(profile.user_id),
        "title": profile.title,
        "department": profile.department,
        "office_name": profile.office_name,
        "responsibilities_summary": profile.responsibilities_summary,
        "role_guidelines_summary": profile.role_guidelines_summary,
        "created_at": profile.created_at.isoformat() if profile.created_at else None,
        "updated_at": profile.updated_at.isoformat() if profile.updated_at else None,
    }


@router.get("")
async def get_employee_profile(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(EmployeeProfile).where(EmployeeProfile.account_id == account.id, EmployeeProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Employee profile not found.")
    return _serialize(profile)


@router.put("")
async def upsert_employee_profile(
    req: EmployeeProfileRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(EmployeeProfile).where(EmployeeProfile.account_id == account.id, EmployeeProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile:
        profile.title = req.title
        profile.department = req.department
        profile.office_name = req.office_name
        profile.responsibilities_summary = req.responsibilities_summary
        profile.role_guidelines_summary = req.role_guidelines_summary
    else:
        profile = EmployeeProfile(
            account_id=account.id,
            user_id=user_id,
            title=req.title,
            department=req.department,
            office_name=req.office_name,
            responsibilities_summary=req.responsibilities_summary,
            role_guidelines_summary=req.role_guidelines_summary,
        )
        db.add(profile)
    await db.flush()
    return _serialize(profile)
