# Relayr Backend

FastAPI backend for the Relayr AI Executive Assistant.

## Quick Start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Copy and fill in environment variables
cp .env.example .env

# Run the dev server
uvicorn app.main:app --reload --port 8000
```

## API Docs

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Architecture

The backend implements a 3-layer intelligence pipeline:

1. **Layer 1 — Writing Style Learning**: Analyzes staff sent emails to build per-person style profiles
2. **Layer 2 — Policy RAG**: Ingests university rulebooks as chunked documents for retrieval
3. **Layer 3 — AI Draft Generation**: Combines style + policy context to generate email drafts

### Tech Stack

- **FastAPI** + Uvicorn (async API server)
- **SQLAlchemy** + Alembic (ORM + migrations)
- **Supabase PostgreSQL** + pgvector (database with vector search)
- **OpenRouter** (LLM API, OpenAI-compatible)
- **Supabase Auth** (JWT verification)

### Project Structure

```
backend/
├── app/
│   ├── main.py           # FastAPI app entry point
│   ├── config.py          # Settings from env vars
│   ├── database.py        # Async SQLAlchemy session
│   ├── auth/              # JWT verification middleware
│   ├── email/             # Gmail OAuth + email operations
│   ├── persona/           # Layer 1: Writing style analysis
│   ├── policy/            # Layer 2: Policy RAG
│   ├── draft/             # Layer 3: AI draft generation
│   ├── routing/           # Email routing rules
│   └── models/            # SQLAlchemy models
├── alembic/               # Database migrations
├── Dockerfile             # Container for Cloud Run
└── pyproject.toml         # Dependencies
```

## Database Migrations

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "description"

# Run migrations
alembic upgrade head
```

## Deployment (Google Cloud Run)

```bash
# Build and push container
gcloud builds submit --tag gcr.io/PROJECT_ID/relayr-backend

# Deploy
gcloud run deploy relayr-backend \
  --image gcr.io/PROJECT_ID/relayr-backend \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars "SUPABASE_URL=...,SUPABASE_SERVICE_ROLE_KEY=..."
```
