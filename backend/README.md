# Relayr Backend

FastAPI backend for the Relayr MVP. It owns Gmail integration, persona generation, employee profile context, draft generation, approval, and send orchestration.

## Local Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

## Required Environment Variables

Fill [backend/.env.example](/Users/tahseenjahan/development/relayr-devin/backend/.env.example:1) into `backend/.env`.

Required for startup and live flows:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SUPABASE_DB_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `APP_ENCRYPTION_KEY`
- `OPENROUTER_API_KEY`

Helpful notes:

- Use the Supabase session pooler URL for `SUPABASE_DB_URL`
- Keep the async driver prefix: `postgresql+asyncpg://...`
- URL-encode special characters in the database password
- Generate `APP_ENCRYPTION_KEY` with:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Local Verification

Backend tests:

```bash
cd backend
source .venv/bin/activate
pytest
```

Import/startup smoke check:

```bash
cd backend
source .venv/bin/activate
python -c "import sys; sys.path.insert(0, '.'); import app.main; print('backend-import-ok')"
```

Health check after boot:

```bash
curl http://127.0.0.1:8000/api/health
```

Expected response:

```json
{"status":"ok","service":"relayr-backend"}
```

## MVP Service Areas

- `app/email`: Gmail connect, status, metadata listing, thread fetch, send
- `app/persona`: persona source email selection and persona build
- `app/employee`: employee role/profile context
- `app/draft`: contextual draft generation, approval, send
- `app/policy`: rulebook upload and retrieval hooks for later phases
- `app/services`: orchestration, Gmail token handling, encryption, prompt assembly

## Verification Gates

The backend is only fully verified when:

- dependencies install cleanly
- migrations succeed against the target Supabase database
- imports succeed
- FastAPI starts locally
- `/api/health` responds
- authenticated routes accept a real Supabase JWT
- Gmail connect and send flow works with a real Google OAuth app
- OpenRouter-powered persona and draft generation work with a real API key

## Current Automated Coverage

The current backend test suite covers:

- health endpoint
- Gmail status route contract
- persona selection validation
- persona build route contract
- draft generate/approve/send route contract
