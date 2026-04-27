import json
import socket
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

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


def verify_database_host_resolvable() -> None:
    """Fail fast when the DB hostname does not resolve (common with IPv6-only Supabase direct URLs)."""
    raw = (settings.supabase_db_url or "").strip()
    if not raw:
        raise RuntimeError("SUPABASE_DB_URL is empty. Set it in backend/.env")
    url = make_url(raw)
    if not url.host:
        raise RuntimeError("SUPABASE_DB_URL has no host.")
    try:
        socket.getaddrinfo(url.host, url.port or 5432, type=socket.SOCK_STREAM)
    except socket.gaierror as e:
        raise RuntimeError(
            f"Cannot resolve database host {url.host!r} ({e}). "
            "Supabase direct connections (db.<project>.supabase.co:5432) use IPv6-only DNS. "
            "If your network or Python cannot use IPv6, open Supabase Dashboard → "
            "Project Settings → Database → Connect → Session pooler, copy the URI, "
            "change the scheme to postgresql+asyncpg://, and set SUPABASE_DB_URL to that value "
            "(pooler hosts such as aws-0-<region>.pooler.supabase.com resolve over IPv4)."
        ) from e


_raw_db = (settings.supabase_db_url or "").strip()
_engine_db_url = _raw_db
if _engine_db_url.startswith("postgresql://"):
    # Force async driver URL; a plain postgresql:// URL makes SQLAlchemy load psycopg2.
    _engine_db_url = _engine_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
# Supabase requires TLS. Transaction pooler (port 6543) must disable asyncpg prepared statement cache.
if settings.supabase_db_ssl_verify:
    _ssl_value: bool | str = True
else:
    # asyncpg `ssl="require"` keeps TLS but does not verify certificate chain.
    _ssl_value = "require"
_connect_args: dict = {"ssl": _ssl_value}
if _engine_db_url:
    _parsed = make_url(_engine_db_url)
    if _parsed.port == 6543:
        _connect_args["statement_cache_size"] = 0
    # region agent log
    _debug_log(
        "H11",
        "app/database.py:engine_config",
        "database engine SSL configuration selected",
        {
            "host": _parsed.host or "",
            "port": _parsed.port or 0,
            "ssl_verify_enabled": settings.supabase_db_ssl_verify,
            "using_pooler_port_6543": (_parsed.port == 6543),
        },
    )
    # endregion

engine = create_async_engine(
    _engine_db_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_connect_args,
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            # region agent log
            _debug_log(
                "H12",
                "app/database.py:get_db_exception",
                "database session failed",
                {"error_type": e.__class__.__name__, "error": str(e)},
            )
            # endregion
            await session.rollback()
            raise
