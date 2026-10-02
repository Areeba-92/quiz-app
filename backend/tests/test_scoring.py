import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas import Question
from app.scoring import normalise_answer, score_attempt


def question(number: int, correct: str | None = "A", source: str | None = "key", **kwargs):
    return Question(
        number=number,
        text=f"Question {number}",
        options={letter: f"option {letter}" for letter in "ABCD"},
        correct=correct,
        answer_source=source,
        **kwargs,
    )


def test_all_correct():
    questions = [question(1, "A"), question(2, "B")]
    result = score_attempt(questions, {1: "A", 2: "B"})

    assert result.score_all == result.score_key_only
    assert (result.score_all.correct, result.score_all.total) == (2, 2)
    assert result.wrong == []
    assert result.answered == 2


def test_wrong_answer_is_reported_with_the_reason():
    questions = [question(1, "A", explanation="because it learns", explanation_source="key")]
    result = score_attempt(questions, {1: "C"})

    assert result.score_all.correct == 0
    assert len(result.wrong) == 1
    assert result.wrong[0].your_answer == "C"
    assert result.wrong[0].correct == "A"
    assert result.wrong[0].explanation == "because it learns"
    assert result.wrong[0].options["A"] == "option A"


def test_unanswered_question_counts_as_wrong_and_is_listed():
    questions = [question(1, "A"), question(2, "B")]
    result = score_attempt(questions, {1: "A"})

    assert (result.score_all.correct, result.score_all.total) == (1, 2)
    assert result.answered == 1
    assert [w.number for w in result.wrong] == [2]
    assert result.wrong[0].your_answer is None


def test_ai_answers_are_excluded_from_the_key_backed_score():
    """The honesty rule: an AI guess must not move the key-backed score."""
    questions = [
        question(1, "A", source="key"),
        question(2, "B", source="key"),
        question(3, "C", source="ai"),
    ]
    result = score_attempt(questions, {1: "A", 2: "B", 3: "D"})

    assert (result.score_key_only.correct, result.score_key_only.total) == (2, 2)
    assert (result.score_all.correct, result.score_all.total) == (2, 3)


def test_a_right_ai_answer_also_stays_out_of_the_key_backed_score():
    questions = [question(1, "A", source="key"), question(2, "B", source="ai")]
    result = score_attempt(questions, {1: "A", 2: "B"})

    assert (result.score_key_only.correct, result.score_key_only.total) == (1, 1)
    assert (result.score_all.correct, result.score_all.total) == (2, 2)


def test_question_with_no_correct_answer_cannot_be_marked():
    questions = [question(1, "A"), question(2, correct=None, source=None)]
    result = score_attempt(questions, {1: "A", 2: "C"})

    assert result.unscored == [2]
    assert result.score_all.total == 1
    assert [w.number for w in result.wrong] == []


def test_scoring_is_by_question_number_not_position():
    questions = [question(3, "C"), question(1, "A"), question(2, "B")]
    result = score_attempt(questions, {1: "A", 2: "B", 3: "C"})

    assert result.score_all.correct == 3
    assert result.wrong == []


def test_no_key_backed_questions_gives_a_zero_total():
    questions = [question(1, "A", source="ai")]
    result = score_attempt(questions, {1: "A"})

    assert result.score_key_only.total == 0
    assert result.score_all.total == 1


@pytest.mark.parametrize("given", ["a", "A", " a ", "(A)", "A."])
def test_answer_letters_are_normalised(given):
    assert normalise_answer(given) == "A"
    assert score_attempt([question(1, "A")], {1: given}).score_all.correct == 1


def test_empty_answer_is_treated_as_unanswered():
    assert normalise_answer("  ") is None
    result = score_attempt([question(1, "A")], {1: "  "})
    assert result.answered == 0
    assert [w.number for w in result.wrong] == [1]


# --- endpoint ------------------------------------------------------------


@pytest.fixture
def client():
    return TestClient(app)


def test_score_endpoint(client):
    payload = {
        "questions": [question(1, "A").model_dump(), question(2, "B").model_dump()],
        "answers": {"1": "A", "2": "D"},
    }
    response = client.post("/score", json=payload)
    assert response.status_code == 200

    body = response.json()
    assert body["score_all"] == {"correct": 1, "total": 2}
    assert body["score_key_only"] == {"correct": 1, "total": 2}
    assert [w["number"] for w in body["wrong"]] == [2]


def test_score_endpoint_rejects_an_empty_quiz(client):
    response = client.post("/score", json={"questions": [], "answers": {}})
    assert response.status_code == 422


def test_score_endpoint_rejects_answers_for_unknown_questions(client):
    payload = {"questions": [question(1, "A").model_dump()], "answers": {"99": "A"}}
    response = client.post("/score", json=payload)

    assert response.status_code == 422
    assert "not in this quiz" in response.json()["detail"]
