import uuid

import pytest
from fastapi.testclient import TestClient

from app.auth.middleware import verify_supabase_jwt
from app.database import get_db
from app.main import app


TEST_USER_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


@pytest.fixture
def client():
    async def fake_verify():
        return TEST_USER_ID

    async def fake_db():
        yield object()

    app.dependency_overrides[verify_supabase_jwt] = fake_verify
    app.dependency_overrides[get_db] = fake_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
