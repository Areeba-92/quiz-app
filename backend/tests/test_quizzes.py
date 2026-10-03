import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def question(number: int, correct: str | None = "A", source: str | None = "key") -> dict:
    return {
        "number": number,
        "text": f"Question {number}",
        "options": {"A": "alpha", "B": "beta", "C": "gamma"},
        "correct": correct,
        "answer_source": source,
    }


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def quiz_id(client):
    questions = [question(1), question(2, "B"), question(3, "C", "ai"), question(4, None, None)]
    response = client.post("/quizzes", json={"title": "Mock", "questions": questions})
    assert response.status_code == 200
    return response.json()["id"]


def test_a_saved_quiz_can_be_read_back(quiz_id):
    questions = db.get_quiz_questions(quiz_id)
    assert [q.number for q in questions] == [1, 2, 3, 4]
    assert questions[2].answer_source == "ai"


def test_an_empty_quiz_is_not_saved(client):
    response = client.post("/quizzes", json={"title": "Empty", "questions": []})
    assert response.status_code == 422


def test_an_attempt_is_scored_and_stored(client, quiz_id, tmp_path):
    response = client.post(f"/quizzes/{quiz_id}/attempts", json={"answers": {"1": "A", "2": "A"}})
    assert response.status_code == 200

    body = response.json()
    assert body["quiz_id"] == quiz_id
    assert body["score_key_only"] == {"correct": 1, "total": 2}
    assert body["score_all"] == {"correct": 1, "total": 3}
    assert [w["number"] for w in body["wrong"]] == [2, 3]
    assert body["unscored"] == [4]

    with sqlite3.connect(tmp_path / "test.db") as conn:
        rows = conn.execute("SELECT quiz_id, numbers FROM attempts").fetchall()
    assert rows == [(quiz_id, "[1, 2, 3, 4]")]


def test_a_retry_covers_only_the_numbers_sent(client, quiz_id):
    response = client.post(
        f"/quizzes/{quiz_id}/attempts", json={"answers": {"2": "B"}, "numbers": [2, 3]}
    )
    body = response.json()

    assert body["score_all"] == {"correct": 1, "total": 2}
    assert [w["number"] for w in body["wrong"]] == [3]


def test_scoring_uses_the_saved_copy(client, quiz_id):
    # Extra fields such as questions are ignored: the browser cannot change the answers.
    response = client.post(
        f"/quizzes/{quiz_id}/attempts",
        json={"answers": {"1": "B"}, "numbers": [1], "questions": [question(1, "B")]},
    )
    assert response.json()["score_all"] == {"correct": 0, "total": 1}


def test_an_unknown_quiz_is_a_404(client):
    assert client.post("/quizzes/999/attempts", json={"answers": {}}).status_code == 404


def test_numbers_outside_the_quiz_are_rejected(client, quiz_id):
    response = client.post(f"/quizzes/{quiz_id}/attempts", json={"numbers": [1, 9]})
    assert response.status_code == 422
    assert "[9]" in response.json()["detail"]


def test_answers_outside_the_attempt_are_rejected(client, quiz_id):
    response = client.post(
        f"/quizzes/{quiz_id}/attempts", json={"answers": {"1": "A"}, "numbers": [2]}
    )
    assert response.status_code == 422
