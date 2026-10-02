import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_pdf

QUIZ = "Q1. What is AI?\nA.  A learned system\nB.  A fixed rule\nQ2. What is ML?\nA.  One approach\nB.  A spreadsheet"
# Long enough to clear the "page has no text layer" threshold in pdf_text.
KEY = "Answer Key\nQuick Key\nQ1: A\nQ2: A"


@pytest.fixture
def client():
    return TestClient(app)


def upload(name: str, body: str):
    return (name, make_pdf([body]), "application/pdf")


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_quiz_only_parses_but_answers_nothing(client):
    response = client.post("/parse", files={"quiz": upload("quiz.pdf", QUIZ)})
    assert response.status_code == 200

    body = response.json()
    assert body["question_count"] == 2
    assert [q["number"] for q in body["questions"]] == [1, 2]
    assert all(q["correct"] is None for q in body["questions"])
    assert "no_answer_key" in [w["code"] for w in body["warnings"]]
    assert body["pages"] == {"total": 1, "text_pages": 1, "scanned_pages": []}


def test_quiz_with_key_is_answered(client):
    response = client.post(
        "/parse",
        files={"quiz": upload("quiz.pdf", QUIZ), "answer_key": upload("key.pdf", KEY)},
    )
    assert response.status_code == 200

    body = response.json()
    assert [q["correct"] for q in body["questions"]] == ["A", "A"]
    assert [q["answer_source"] for q in body["questions"]] == ["key", "key"]
    assert body["warnings"] == []


def test_response_matches_the_documented_schema(client):
    response = client.post("/parse", files={"quiz": upload("quiz.pdf", QUIZ)})
    question = response.json()["questions"][0]

    assert set(question) == {
        "number",
        "text",
        "options",
        "correct",
        "answer_source",
        "explanation",
        "explanation_source",
        "issues",
    }


def test_a_non_pdf_upload_is_rejected(client):
    response = client.post(
        "/parse", files={"quiz": ("notes.txt", b"just some text", "text/plain")}
    )
    assert response.status_code == 400
    assert "not a PDF" in response.json()["detail"]


def test_a_pdf_with_no_questions_is_rejected(client):
    response = client.post(
        "/parse", files={"quiz": upload("empty.pdf", "This document has no questions.")}
    )
    assert response.status_code == 422
    assert "No questions" in response.json()["detail"]


def test_a_broken_answer_key_is_reported_separately(client):
    response = client.post(
        "/parse",
        files={
            "quiz": upload("quiz.pdf", QUIZ),
            "answer_key": ("key.txt", b"not a pdf at all", "text/plain"),
        },
    )
    assert response.status_code == 400
    assert response.json()["detail"].startswith("Answer key:")


def test_missing_quiz_file_is_a_validation_error(client):
    assert client.post("/parse").status_code == 422
