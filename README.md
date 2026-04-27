# Relayr MVP

Relayr is an AI-assisted email drafting workflow for educational staff. The local MVP uses a React frontend, a FastAPI backend, Supabase Auth/Postgres, Gmail, and OpenRouter.

## Local MVP Architecture

- Frontend: Vite + React on `http://localhost:8080`
- Backend: FastAPI on `http://127.0.0.1:8000`
- Auth: Supabase Auth
- Database: Supabase Postgres
- Email provider: Gmail
- LLM provider: OpenRouter

The frontend proxies `/api/*` requests to the FastAPI backend during local development.

## Required Accounts And Keys

Before the full MVP can run end-to-end, you need:

- One Supabase project with:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_JWT_SECRET`
  - `SUPABASE_DB_URL`
- One Google Cloud OAuth app with Gmail scopes for read/send:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
- One OpenRouter API key:
  - `OPENROUTER_API_KEY`
- One Fernet key for app-layer token encryption:
  - `APP_ENCRYPTION_KEY`

## Frontend Setup

```bash
cp .env.example .env
npm install
npm run dev
```

Fill [/.env.example](/Users/tahseenjahan/development/relayr-devin/.env.example:1) into your local `.env` with:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_GMAIL_TRANSPORT=fastapi`

## Backend Setup

See the backend-specific guide in [backend/README.md](/Users/tahseenjahan/development/relayr-devin/backend/README.md:1).

Quick start:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Verification Commands

Frontend:

```bash
npm test
npm run build
```

Backend:

```bash
cd backend
source .venv/bin/activate
pytest
python -c "import sys; sys.path.insert(0, '.'); import app.main; print('backend-import-ok')"
```

## Full Verification Checklist

Verification is only considered complete when all of these are true:

- Backend dependencies install cleanly
- `alembic upgrade head` succeeds against your Supabase database
- FastAPI boots locally and `/api/health` returns `ok`
- Frontend boots on `http://localhost:8080`
- Supabase sign-in works locally
- Gmail connection succeeds
- Persona selection and persona build succeed
- Draft generation, approval, and send succeed

## Current Automated Coverage

Already wired into the repo:

- Backend API tests for health, Gmail status, persona selection/build, and draft lifecycle
- Frontend tests for persona setup and ticket draft flow
- Frontend production build validation

## Remaining Manual Steps

These still require your real credentials and third-party configuration:

- Supabase project configuration
- Google OAuth consent screen and redirect URIs
- OpenRouter key
- Real local `.env` files
- Live Gmail and LLM verification
