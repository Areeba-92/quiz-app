import pytest
from fastapi.testclient import TestClient

from app import ai
from app.main import app

QUESTION = {
    "number": 3,
    "text": "Which is AI?",
    "options": {"A": "a calculator", "B": "a learned model"},
    "correct": "B",
    "answer_source": "key",
}


@pytest.fixture
def client():
    return TestClient(app)


def test_returns_openais_own_pick(client, monkeypatch):
    monkeypatch.setattr(ai, "is_configured", lambda: True)
    monkeypatch.setattr(ai, "check_answer", lambda question: ("A", "Calculators compute."))

    response = client.post("/check", json={"question": QUESTION})
    assert response.status_code == 200
    assert response.json() == {"ai_answer": "A", "ai_reason": "Calculators compute."}


def test_says_so_when_openai_is_not_set_up(client):
    response = client.post("/check", json={"question": QUESTION})
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_a_failed_check_is_a_plain_502(client, monkeypatch):
    def fail(question):
        raise ai.CheckFailed("The OpenAI request failed: RateLimitError (HTTP 429)")

    monkeypatch.setattr(ai, "is_configured", lambda: True)
    monkeypatch.setattr(ai, "check_answer", fail)

    response = client.post("/check", json={"question": QUESTION})
    assert response.status_code == 502
    assert "HTTP 429" in response.json()["detail"]


def test_a_question_with_too_few_options_is_rejected(client, monkeypatch):
    monkeypatch.setattr(ai, "is_configured", lambda: True)
    question = {**QUESTION, "options": {"A": "only one"}}
    assert client.post("/check", json={"question": question}).status_code == 422
