"""Gmail API client — server-side implementation ported from the Supabase edge function."""

import base64
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from uuid import uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.google_token import GoogleToken

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
DEBUG_LOG_PATH = Path("/Users/tahseenjahan/development/.cursor/debug-dfaa24.log")


def _debug_log(hypothesis_id: str, location: str, message: str, data: dict[str, object]) -> None:
    payload = {
        "sessionId": "dfaa24",
        "runId": "pre-fix",
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


async def exchange_oauth_code(
    code: str, redirect_uri: str, user_id: str, db: AsyncSession
) -> dict[str, object]:
    """Exchange an authorization code for tokens and store them in the DB."""
    # region agent log
    _debug_log(
        "H1",
        "app/email/gmail_client.py:exchange_oauth_code:entry",
        "exchange_oauth_code called",
        {"redirect_uri": redirect_uri, "code_len": len(code), "user_id_present": bool(user_id)},
    )
    # endregion
    async with httpx.AsyncClient() as client:
        # region agent log
        _debug_log(
            "H2",
            "app/email/gmail_client.py:exchange_oauth_code:before_token_post",
            "posting to google token endpoint",
            {
                "url": GOOGLE_TOKEN_URL,
                "has_client_id": bool(settings.google_client_id),
                "has_client_secret": bool(settings.google_client_secret),
            },
        )
        # endregion
        try:
            resp = await client.post(
                GOOGLE_TOKEN_URL,
                data={
                    "code": code,
                    "client_id": settings.google_client_id,
                    "client_secret": settings.google_client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code",
                },
            )
        except Exception as e:
            # region agent log
            _debug_log(
                "H3",
                "app/email/gmail_client.py:exchange_oauth_code:token_post_exception",
                "exception during google token exchange HTTP call",
                {"error_type": e.__class__.__name__, "error": str(e)},
            )
            # endregion
            raise
        # region agent log
        _debug_log(
            "H4",
            "app/email/gmail_client.py:exchange_oauth_code:token_post_response",
            "google token endpoint responded",
            {"status_code": resp.status_code, "content_type": resp.headers.get("content-type", "")},
        )
        # endregion
        if resp.status_code != 200:
            raise ValueError(f"Token exchange failed: {resp.text}")
        tokens = resp.json()

        # Fetch user email from Google
        profile_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
        # region agent log
        _debug_log(
            "H5",
            "app/email/gmail_client.py:exchange_oauth_code:userinfo_response",
            "google userinfo endpoint responded",
            {"status_code": profile_resp.status_code},
        )
        # endregion
        profile = profile_resp.json() if profile_resp.status_code == 200 else {}

    import uuid

    expires_at = datetime.now(UTC) + timedelta(seconds=tokens.get("expires_in", 3600))

    # Upsert token
    result = await db.execute(select(GoogleToken).where(GoogleToken.user_id == uuid.UUID(user_id)))
    existing = result.scalar_one_or_none()

    if existing:
        existing.access_token = tokens["access_token"]
        existing.refresh_token = tokens.get("refresh_token") or existing.refresh_token
        existing.expires_at = expires_at
        existing.scopes = tokens.get("scope", "")
        existing.email = profile.get("email")
    else:
        db.add(
            GoogleToken(
                user_id=uuid.UUID(user_id),
                access_token=tokens["access_token"],
                refresh_token=tokens.get("refresh_token"),
                expires_at=expires_at,
                scopes=tokens.get("scope", ""),
                email=profile.get("email"),
            )
        )

    return {"email": profile.get("email"), "connected": True}


async def get_valid_token(user_id: str, db: AsyncSession) -> tuple[str, str]:
    """Get a valid access token, refreshing if needed. Returns (token, email)."""
    import uuid

    result = await db.execute(select(GoogleToken).where(GoogleToken.user_id == uuid.UUID(user_id)))
    token_row = result.scalar_one_or_none()

    if not token_row:
        raise ValueError("Gmail not connected. Please connect your Gmail account first.")

    now = datetime.now(UTC)
    if now < token_row.expires_at - timedelta(seconds=60):
        return token_row.access_token, token_row.email or ""

    # Token expired — refresh
    if not token_row.refresh_token:
        raise ValueError("Gmail session expired. Please reconnect your Gmail account.")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": token_row.refresh_token,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
        if resp.status_code != 200:
            raise ValueError("Token refresh failed. Please reconnect your Gmail account.")
        refreshed = resp.json()

    token_row.access_token = refreshed["access_token"]
    token_row.expires_at = datetime.now(UTC) + timedelta(seconds=refreshed.get("expires_in", 3600))

    return refreshed["access_token"], token_row.email or ""


async def check_connection(user_id: str, db: AsyncSession) -> dict[str, object]:
    """Check if a user has Gmail connected."""
    import uuid

    # region agent log
    _debug_log(
        "H10",
        "app/email/gmail_client.py:check_connection:entry",
        "check_connection called",
        {"user_id_present": bool(user_id)},
    )
    # endregion
    result = await db.execute(select(GoogleToken).where(GoogleToken.user_id == uuid.UUID(user_id)))
    token_row = result.scalar_one_or_none()
    if not token_row:
        return {"connected": False}
    return {"connected": True, "email": token_row.email, "scopes": token_row.scopes}


async def disconnect_gmail(user_id: str, db: AsyncSession) -> dict[str, bool]:
    """Disconnect Gmail by revoking the token and deleting from DB."""
    import uuid

    result = await db.execute(select(GoogleToken).where(GoogleToken.user_id == uuid.UUID(user_id)))
    token_row = result.scalar_one_or_none()

    if token_row:
        # Try to revoke at Google
        try:
            async with httpx.AsyncClient() as client:
                await client.post(f"https://oauth2.googleapis.com/revoke?token={token_row.access_token}")
        except Exception:
            pass
        await db.delete(token_row)

    return {"disconnected": True}


async def fetch_messages(
    token: str, max_results: int = 20, query: str = "", label_id: str | None = None
) -> list[dict[str, str]]:
    """Fetch email messages from Gmail API."""
    async with httpx.AsyncClient() as client:
        # List message IDs
        params: dict[str, str] = {"maxResults": str(max_results)}
        if query:
            params["q"] = query
        if label_id:
            params["labelIds"] = label_id

        resp = await client.get(f"{GMAIL_BASE}/messages", params=params, headers={"Authorization": f"Bearer {token}"})
        if resp.status_code != 200:
            raise ValueError(f"Gmail list error: {resp.status_code}")
        data = resp.json()
        message_ids = [m["id"] for m in data.get("messages", [])]

        # Fetch metadata for each message (batched)
        results: list[dict[str, str]] = []
        for i in range(0, min(len(message_ids), max_results), 5):
            batch = message_ids[i : i + 5]
            tasks = [_fetch_message_meta(client, token, mid) for mid in batch]
            import asyncio

            fetched = await asyncio.gather(*tasks, return_exceptions=True)
            for msg in fetched:
                if isinstance(msg, dict):
                    results.append(msg)

    return results


async def _fetch_message_meta(client: httpx.AsyncClient, token: str, message_id: str) -> dict[str, str]:
    """Fetch metadata for a single Gmail message."""
    resp = await client.get(
        f"{GMAIL_BASE}/messages/{message_id}",
        params={
            "format": "metadata",
            "metadataHeaders": ["Subject", "To", "From", "Date"],
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    if resp.status_code != 200:
        raise ValueError(f"Gmail message fetch error: {resp.status_code}")

    data = resp.json()
    headers = data.get("payload", {}).get("headers", [])

    def get_header(name: str) -> str:
        for h in headers:
            if h.get("name", "").lower() == name.lower():
                return h.get("value", "")
        return ""

    return {
        "id": message_id,
        "threadId": data.get("threadId", ""),
        "subject": get_header("Subject") or "(no subject)",
        "snippet": data.get("snippet", ""),
        "date": get_header("Date"),
        "from": get_header("From"),
        "to": get_header("To"),
    }


async def send_email(
    token: str, to: str, subject: str, body: str, thread_id: str | None = None
) -> dict[str, object]:
    """Send an email via Gmail API."""
    raw_subject = subject if subject.startswith("Re: ") else f"Re: {subject}"
    message_lines = [
        f"To: {to}",
        f"Subject: {raw_subject}",
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
    ]
    raw_message = "\r\n".join(message_lines)
    encoded = base64.urlsafe_b64encode(raw_message.encode("utf-8")).decode("ascii").rstrip("=")

    payload: dict[str, str] = {"raw": encoded}
    if thread_id:
        payload["threadId"] = thread_id

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GMAIL_BASE}/messages/send",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        if resp.status_code != 200:
            raise ValueError(f"Gmail send error: {resp.status_code} {resp.text}")
        return resp.json()


async def fetch_full_message(token: str, message_id: str) -> dict[str, object]:
    """Fetch full message content for style analysis."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{GMAIL_BASE}/messages/{message_id}",
            params={"format": "full"},
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code != 200:
            raise ValueError(f"Gmail fetch error: {resp.status_code}")
        data = resp.json()

    # Extract plain text body
    body_text = _extract_body(data.get("payload", {}))
    headers = data.get("payload", {}).get("headers", [])

    def get_header(name: str) -> str:
        for h in headers:
            if h.get("name", "").lower() == name.lower():
                return h.get("value", "")
        return ""

    return {
        "id": message_id,
        "threadId": data.get("threadId", ""),
        "subject": get_header("Subject"),
        "from": get_header("From"),
        "to": get_header("To"),
        "date": get_header("Date"),
        "body": body_text,
        "snippet": data.get("snippet", ""),
    }


def _extract_body(payload: dict[str, object]) -> str:
    """Recursively extract plain text body from Gmail message payload."""
    mime_type = payload.get("mimeType", "")
    if mime_type == "text/plain":
        body_data = payload.get("body", {})
        if isinstance(body_data, dict):
            data = body_data.get("data", "")
            if isinstance(data, str) and data:
                # Gmail uses URL-safe base64
                padded = data + "=" * (4 - len(data) % 4)
                return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    parts = payload.get("parts", [])
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, dict):
                text = _extract_body(part)
                if text:
                    return text
    return ""
