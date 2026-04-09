from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.config import settings
from app.draft.router import router as draft_router
from app.email.router import router as email_router
from app.persona.router import router as persona_router
from app.policy.router import router as policy_router
from app.routing.router import router as routing_router

app = FastAPI(
    title="Relayr Backend",
    description="AI Executive Assistant for Educational Institution Staff",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(email_router, prefix="/api/email", tags=["email"])
app.include_router(persona_router, prefix="/api/persona", tags=["persona"])
app.include_router(policy_router, prefix="/api/policy", tags=["policy"])
app.include_router(draft_router, prefix="/api/draft", tags=["draft"])
app.include_router(routing_router, prefix="/api/routing", tags=["routing"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "relayr-backend"}
