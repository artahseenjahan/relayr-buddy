from contextlib import asynccontextmanager
import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.config import settings
from app.database import verify_database_host_resolvable
from app.draft.router import router as draft_router
from app.employee.router import router as employee_router
from app.email.router import router as email_router
from app.persona.router import router as persona_router
from app.policy.router import router as policy_router
from app.routing.router import router as routing_router

DEBUG_LOG_PATH = Path("/Users/tahseenjahan/development/.cursor/debug-dfaa24.log")


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict[str, object]) -> None:
    payload = {
        "sessionId": "dfaa24",
        "runId": "post-fix",
        "hypothesisId": hypothesis_id,
        "id": f"log_{uuid4().hex}",
        "location": location,
        "message": message,
        "data": data,
        "timestamp": int(datetime.now(UTC).timestamp() * 1000),
    }
    try:
        with DEBUG_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload, ensure_ascii=True) + "\n")
    except Exception:
        pass


@asynccontextmanager
async def lifespan(_app: FastAPI):
    try:
        verify_database_host_resolvable()
    except RuntimeError as e:
        # Keep API up even when DB host is unavailable, so frontend can still load
        # and endpoints with graceful fallbacks can respond.
        # region agent log
        _debug_log(
            "H18",
            "app/main.py:lifespan",
            "database host preflight failed; startup continued",
            {"error_type": e.__class__.__name__, "error": str(e)},
        )
        # endregion
    yield


app = FastAPI(
    title="Relayr Backend",
    description="AI Executive Assistant for Educational Institution Staff",
    version="0.1.0",
    lifespan=lifespan,
)

_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chrome may send Access-Control-Request-Private-Network on cross-origin local requests
@app.middleware("http")
async def allow_private_network(request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network") == "true":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response

app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(email_router, prefix="/api/email", tags=["email"])
app.include_router(employee_router, prefix="/api/employee-profile", tags=["employee-profile"])
app.include_router(persona_router, prefix="/api/persona", tags=["persona"])
app.include_router(policy_router, prefix="/api/policy", tags=["policy"])
app.include_router(draft_router, prefix="/api/draft", tags=["draft"])
app.include_router(routing_router, prefix="/api/routing", tags=["routing"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "relayr-backend"}
