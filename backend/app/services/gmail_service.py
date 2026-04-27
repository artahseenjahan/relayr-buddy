"""Gmail integration service for the Relayr MVP."""

from __future__ import annotations

import base64
import re
import uuid
from datetime import UTC, datetime, timedelta
from email.utils import parsedate_to_datetime

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.mvp import GmailConnection
from app.services.security import decrypt_secret, encrypt_secret
from app.services.workspace import get_account_for_user

GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


def _parse_scopes(raw: str | None) -> dict[str, object]:
    scopes = [scope for scope in (raw or "").split() if scope]
    return {"items": scopes}


def _parse_address_list(value: str) -> list[str]:
    if not value:
        return []
    return [item.strip() for item in re.split(r",(?![^<]*>)", value) if item.strip()]


def _parse_message_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = parsedate_to_datetime(value)
        return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    except Exception:
        return None


def _extract_body(payload: dict[str, object]) -> str:
    mime_type = payload.get("mimeType", "")
    if mime_type == "text/plain":
        body_data = payload.get("body", {})
        if isinstance(body_data, dict):
            data = body_data.get("data", "")
            if isinstance(data, str) and data:
                padded = data + "=" * (-len(data) % 4)
                return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    parts = payload.get("parts", [])
    if isinstance(parts, list):
        for part in parts:
            if isinstance(part, dict):
                text = _extract_body(part)
                if text:
                    return text
    return ""


def _headers_lookup(headers: list[dict[str, object]], name: str) -> str:
    for header in headers:
        if str(header.get("name", "")).lower() == name.lower():
            return str(header.get("value", ""))
    return ""


def _message_metadata_from_payload(data: dict[str, object]) -> dict[str, object]:
    payload = data.get("payload", {})
    headers = payload.get("headers", []) if isinstance(payload, dict) else []
    headers_list = headers if isinstance(headers, list) else []
    return {
        "id": str(data.get("id", "")),
        "thread_id": str(data.get("threadId", "")),
        "subject": _headers_lookup(headers_list, "Subject") or "(no subject)",
        "snippet": str(data.get("snippet", "")),
        "date": _headers_lookup(headers_list, "Date"),
        "from": _headers_lookup(headers_list, "From"),
        "to": _headers_lookup(headers_list, "To"),
    }


async def _fetch_userinfo(access_token: str) -> dict[str, object]:
    async with httpx.AsyncClient() as client:
        response = await client.get(GOOGLE_USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"})
    if response.status_code != 200:
        raise ValueError("Failed to fetch Gmail profile details")
    return response.json()


async def upsert_gmail_connection(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    access_token: str,
    refresh_token: str | None,
    expires_in: int,
    scopes: str | None,
    gmail_email: str,
    google_subject_id: str | None,
) -> GmailConnection:
    account = await get_account_for_user(db, user_id)
    result = await db.execute(
        select(GmailConnection)
        .where(GmailConnection.user_id == user_id)
        .order_by(GmailConnection.created_at.desc())
    )
    connection = result.scalar_one_or_none()
    expiry = datetime.now(UTC) + timedelta(seconds=expires_in)

    if connection:
        connection.account_id = account.id
        connection.gmail_email = gmail_email
        connection.google_subject_id = google_subject_id
        connection.access_token_encrypted = encrypt_secret(access_token)
        if refresh_token:
            connection.refresh_token_encrypted = encrypt_secret(refresh_token)
        connection.token_expiry = expiry
        connection.scopes = _parse_scopes(scopes)
        connection.is_active = True
    else:
        connection = GmailConnection(
            account_id=account.id,
            user_id=user_id,
            gmail_email=gmail_email,
            google_subject_id=google_subject_id,
            access_token_encrypted=encrypt_secret(access_token),
            refresh_token_encrypted=encrypt_secret(refresh_token) if refresh_token else None,
            token_expiry=expiry,
            scopes=_parse_scopes(scopes),
            is_active=True,
        )
        db.add(connection)

    await db.flush()
    return connection


async def exchange_oauth_code(code: str, redirect_uri: str, user_id: uuid.UUID, db: AsyncSession) -> dict[str, object]:
    if not settings.google_client_id or not settings.google_client_secret:
        raise ValueError("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.")
    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.status_code != 200:
        raise ValueError(f"Token exchange failed: {response.text}")

    tokens = response.json()
    profile = await _fetch_userinfo(tokens["access_token"])
    connection = await upsert_gmail_connection(
        db,
        user_id=user_id,
        access_token=tokens["access_token"],
        refresh_token=tokens.get("refresh_token"),
        expires_in=int(tokens.get("expires_in", 3600)),
        scopes=tokens.get("scope"),
        gmail_email=str(profile.get("email", "")),
        google_subject_id=str(profile.get("sub", "")) or None,
    )
    return {
        "connection_id": str(connection.id),
        "email": connection.gmail_email,
        "connected": True,
        "account_id": str(connection.account_id),
    }


async def get_active_connection(db: AsyncSession, user_id: uuid.UUID) -> GmailConnection:
    result = await db.execute(
        select(GmailConnection)
        .where(GmailConnection.user_id == user_id, GmailConnection.is_active.is_(True))
        .order_by(GmailConnection.updated_at.desc())
    )
    connection = result.scalar_one_or_none()
    if not connection:
        raise ValueError("Gmail not connected. Please connect your Gmail account first.")
    return connection


async def get_valid_token(db: AsyncSession, user_id: uuid.UUID) -> tuple[GmailConnection, str]:
    connection = await get_active_connection(db, user_id)
    now = datetime.now(UTC)
    if now < connection.token_expiry - timedelta(seconds=60):
        return connection, decrypt_secret(connection.access_token_encrypted)

    if not connection.refresh_token_encrypted:
        raise ValueError("Gmail session expired. Please reconnect your Gmail account.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": decrypt_secret(connection.refresh_token_encrypted),
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
        )
    if response.status_code != 200:
        raise ValueError("Token refresh failed. Please reconnect your Gmail account.")

    refreshed = response.json()
    connection.access_token_encrypted = encrypt_secret(refreshed["access_token"])
    connection.token_expiry = datetime.now(UTC) + timedelta(seconds=int(refreshed.get("expires_in", 3600)))
    if refreshed.get("scope"):
        connection.scopes = _parse_scopes(refreshed.get("scope"))
    await db.flush()
    return connection, refreshed["access_token"]


async def check_connection(db: AsyncSession, user_id: uuid.UUID) -> dict[str, object]:
    try:
        connection, _ = await get_valid_token(db, user_id)
    except ValueError:
        return {"connected": False}
    return {
        "connected": True,
        "connection_id": str(connection.id),
        "email": connection.gmail_email,
        "account_id": str(connection.account_id),
        "scopes": connection.scopes.get("items", []),
    }


async def disconnect_gmail(db: AsyncSession, user_id: uuid.UUID) -> dict[str, bool]:
    try:
        connection = await get_active_connection(db, user_id)
    except ValueError:
        return {"disconnected": True}

    access_token = decrypt_secret(connection.access_token_encrypted)
    try:
        async with httpx.AsyncClient() as client:
            await client.post("https://oauth2.googleapis.com/revoke", params={"token": access_token})
    except Exception:
        pass

    connection.is_active = False
    await db.flush()
    return {"disconnected": True}


async def fetch_messages(
    token: str,
    *,
    max_results: int = 20,
    query: str = "",
    label_id: str | None = None,
) -> list[dict[str, object]]:
    async with httpx.AsyncClient() as client:
        params: dict[str, str] = {"maxResults": str(max_results)}
        if query:
            params["q"] = query
        if label_id:
            params["labelIds"] = label_id

        response = await client.get(f"{GMAIL_BASE}/messages", params=params, headers={"Authorization": f"Bearer {token}"})
        if response.status_code != 200:
            raise ValueError(f"Gmail list error: {response.status_code} {response.text}")
        message_refs = response.json().get("messages", [])

        results: list[dict[str, object]] = []
        for ref in message_refs[:max_results]:
            message_id = ref.get("id")
            if not message_id:
                continue
            meta_response = await client.get(
                f"{GMAIL_BASE}/messages/{message_id}",
                params={"format": "metadata", "metadataHeaders": ["Subject", "From", "To", "Date"]},
                headers={"Authorization": f"Bearer {token}"},
            )
            if meta_response.status_code == 200:
                results.append(_message_metadata_from_payload(meta_response.json()))
        return results


async def fetch_full_message(token: str, message_id: str) -> dict[str, object]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GMAIL_BASE}/messages/{message_id}",
            params={"format": "full"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise ValueError(f"Gmail fetch error: {response.status_code}")
    data = response.json()
    payload = data.get("payload", {})
    headers = payload.get("headers", []) if isinstance(payload, dict) else []
    headers_list = headers if isinstance(headers, list) else []
    metadata = _message_metadata_from_payload(data)
    metadata["body"] = _extract_body(payload if isinstance(payload, dict) else {})
    metadata["sent_at"] = _parse_message_datetime(str(metadata.get("date", "")))
    metadata["to_emails"] = _parse_address_list(str(metadata.get("to", "")))
    return metadata


async def fetch_thread(token: str, thread_id: str) -> dict[str, object]:
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{GMAIL_BASE}/threads/{thread_id}",
            params={"format": "full"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise ValueError(f"Gmail thread fetch error: {response.status_code}")
    data = response.json()
    messages: list[dict[str, object]] = []
    for message in data.get("messages", []):
        payload = message.get("payload", {})
        headers = payload.get("headers", []) if isinstance(payload, dict) else []
        headers_list = headers if isinstance(headers, list) else []
        messages.append(
            {
                "id": str(message.get("id", "")),
                "thread_id": str(message.get("threadId", "")),
                "from": _headers_lookup(headers_list, "From"),
                "to": _headers_lookup(headers_list, "To"),
                "subject": _headers_lookup(headers_list, "Subject"),
                "date": _headers_lookup(headers_list, "Date"),
                "body": _extract_body(payload if isinstance(payload, dict) else {}),
                "snippet": str(message.get("snippet", "")),
            }
        )
    return {"thread_id": thread_id, "messages": messages}


async def send_email(token: str, *, to: str, subject: str, body: str, thread_id: str | None = None) -> dict[str, object]:
    message_lines = [
        f"To: {to}",
        f"Subject: {subject if subject.startswith('Re: ') else f'Re: {subject}'}",
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
        response = await client.post(
            f"{GMAIL_BASE}/messages/send",
            json=payload,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
    if response.status_code != 200:
        raise ValueError(f"Gmail send error: {response.status_code} {response.text}")
    return response.json()
