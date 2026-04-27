from app.models.mvp import DraftStatus, PersonaStatus


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_gmail_status_returns_payload(client, monkeypatch):
    async def fake_check_connection(_db, _user_id):
        return {"connected": True, "email": "user@example.edu"}

    monkeypatch.setattr("app.email.router.check_connection", fake_check_connection)
    response = client.get("/api/email/status")
    assert response.status_code == 200
    assert response.json()["connected"] is True


def test_persona_selection_error_is_reported(client, monkeypatch):
    async def fake_save_selection(*args, **kwargs):
        raise ValueError("Select at least one email.")

    monkeypatch.setattr("app.persona.router.save_persona_selection", fake_save_selection)
    response = client.post("/api/persona/selection", json={"selected_messages": []})
    assert response.status_code == 400
    assert response.json()["detail"] == "Select at least one email."


def test_persona_build_success(client, monkeypatch):
    async def fake_build_persona(*args, **kwargs):
        return {
            "persona_profile_id": "persona-1",
            "status": PersonaStatus.ready.value,
            "source_email_count": 3,
            "tone_summary": "Warm and concise",
            "style_summary": "Direct but friendly",
            "greeting_patterns": ["Hi there"],
            "signoff_patterns": ["Best"],
            "length_preference": "medium",
            "formatting_preferences": {"uses_bullets": False},
            "preferred_phrases": ["Please let me know"],
            "do_not_use_phrases": [],
        }

    monkeypatch.setattr("app.persona.router.build_persona", fake_build_persona)
    response = client.post("/api/persona/build", json={})
    assert response.status_code == 200
    assert response.json()["status"] == PersonaStatus.ready.value


def test_draft_lifecycle_routes(client, monkeypatch):
    async def fake_generate(*args, **kwargs):
        return {
            "id": "draft-1",
            "status": DraftStatus.draft.value,
            "draft_body": "Generated body",
            "subject": "Test subject",
            "recipient_email": "student@example.edu",
            "generation_context": {},
        }

    async def fake_approve(*args, **kwargs):
        return {
            "id": "draft-1",
            "status": DraftStatus.approved.value,
            "draft_body": "Generated body",
            "subject": "Test subject",
            "recipient_email": "student@example.edu",
            "generation_context": {},
        }

    async def fake_send(*args, **kwargs):
        return {
            "id": "draft-1",
            "status": DraftStatus.sent.value,
            "draft_body": "Generated body",
            "subject": "Test subject",
            "recipient_email": "student@example.edu",
            "generation_context": {},
        }

    monkeypatch.setattr("app.draft.router.generate_draft", fake_generate)
    monkeypatch.setattr("app.draft.router.approve_draft", fake_approve)
    monkeypatch.setattr("app.draft.router.send_draft", fake_send)

    generate_response = client.post("/api/draft/generate", json={"source_gmail_message_id": "abc123"})
    assert generate_response.status_code == 200
    assert generate_response.json()["status"] == DraftStatus.draft.value

    approve_response = client.post("/api/draft/11111111-1111-1111-1111-111111111111/approve")
    assert approve_response.status_code == 200
    assert approve_response.json()["status"] == DraftStatus.approved.value

    send_response = client.post("/api/draft/11111111-1111-1111-1111-111111111111/send")
    assert send_response.status_code == 200
    assert send_response.json()["status"] == DraftStatus.sent.value
