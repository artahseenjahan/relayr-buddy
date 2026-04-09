"""Email routing rules evaluation engine endpoints."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.models.routing import RoutingRule

router = APIRouter()


class RuleCreateRequest(BaseModel):
    name: str
    description: str | None = None
    keywords: list[str] = []
    target_department: str | None = None
    priority: int = 0
    is_active: bool = True


class RuleUpdateRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    keywords: list[str] | None = None
    target_department: str | None = None
    priority: int | None = None
    is_active: bool | None = None


class RuleResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    keywords: list[str] = []
    target_department: str | None = None
    priority: int = 0
    is_active: bool = True


class EvaluateRequest(BaseModel):
    email_subject: str
    email_body: str
    email_from: str


class EvaluateResponse(BaseModel):
    matched_rules: list[RuleResponse]
    suggested_department: str | None = None


def _rule_to_response(rule: RoutingRule) -> RuleResponse:
    return RuleResponse(
        id=str(rule.id),
        name=rule.name,
        description=rule.description,
        keywords=rule.keywords,
        target_department=rule.target_department,
        priority=rule.priority,
        is_active=rule.is_active,
    )


@router.get("/rules")
async def list_rules(
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> list[RuleResponse]:
    """List all routing rules for the authenticated user."""
    result = await db.execute(
        select(RoutingRule)
        .where(RoutingRule.user_id == user_id)
        .order_by(RoutingRule.priority.desc())
    )
    rules = result.scalars().all()
    return [_rule_to_response(r) for r in rules]


@router.post("/rules")
async def create_rule(
    req: RuleCreateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    """Create a new routing rule."""
    rule = RoutingRule(
        user_id=user_id,
        name=req.name,
        description=req.description,
        keywords=req.keywords,
        target_department=req.target_department,
        priority=req.priority,
        is_active=req.is_active,
    )
    db.add(rule)
    await db.flush()
    return _rule_to_response(rule)


@router.patch("/rules/{rule_id}")
async def update_rule(
    rule_id: uuid.UUID,
    req: RuleUpdateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> RuleResponse:
    """Update an existing routing rule."""
    result = await db.execute(
        select(RoutingRule).where(RoutingRule.id == rule_id, RoutingRule.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Routing rule not found.")

    if req.name is not None:
        rule.name = req.name
    if req.description is not None:
        rule.description = req.description
    if req.keywords is not None:
        rule.keywords = req.keywords
    if req.target_department is not None:
        rule.target_department = req.target_department
    if req.priority is not None:
        rule.priority = req.priority
    if req.is_active is not None:
        rule.is_active = req.is_active

    return _rule_to_response(rule)


@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: uuid.UUID,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Delete a routing rule."""
    result = await db.execute(
        select(RoutingRule).where(RoutingRule.id == rule_id, RoutingRule.user_id == user_id)
    )
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Routing rule not found.")

    await db.delete(rule)
    return {"deleted": True}


@router.post("/evaluate")
async def evaluate_routing(
    req: EvaluateRequest,
    user_id: uuid.UUID = Depends(verify_supabase_jwt),
    db: AsyncSession = Depends(get_db),
) -> EvaluateResponse:
    """Evaluate routing rules against an inbound email using keyword matching."""
    result = await db.execute(
        select(RoutingRule)
        .where(RoutingRule.user_id == user_id, RoutingRule.is_active.is_(True))
        .order_by(RoutingRule.priority.desc())
    )
    rules = result.scalars().all()

    email_text = f"{req.email_subject} {req.email_body} {req.email_from}".lower()

    matched: list[RoutingRule] = []
    for rule in rules:
        if any(kw.lower() in email_text for kw in rule.keywords):
            matched.append(rule)

    suggested_dept = matched[0].target_department if matched else None

    return EvaluateResponse(
        matched_rules=[_rule_to_response(r) for r in matched],
        suggested_department=suggested_dept,
    )
