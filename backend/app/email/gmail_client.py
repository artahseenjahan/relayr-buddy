"""Gmail API client — server-side implementation ported from the Supabase edge function."""

import base64
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.google_token import GoogleToken

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


async def exchange_oauth_code(
    code: str, redirect_uri: str, user_id: str, db: AsyncSession
) -> dict[str, object]:
    """Exchange an authorization code for tokens and store them in the DB."""
    async with httpx.AsyncClient() as client:
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
        if resp.status_code != 200:
            raise ValueError(f"Token exchange failed: {resp.text}")
        tokens = resp.json()

        # Fetch user email from Google
        profile_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
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
