"""End-to-end checks against the two real sample PDFs in data/samples/.

These skip cleanly when the samples are absent, so the suite still runs on a
fresh clone.
"""

from collections import Counter

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.parsers import answer_key as answer_key_parser
from app.parsers import pdf_text
from app.parsers.merge import apply_key
from app.parsers.questions import parse_questions
from tests.conftest import KEY_PDF, QUIZ_PDF, needs_samples

pytestmark = needs_samples


@pytest.fixture(scope="module")
def parsed():
    extracted = pdf_text.extract(QUIZ_PDF.read_bytes(), QUIZ_PDF.name)
    questions, warnings = parse_questions(extracted.lines)
    return extracted, questions, warnings


@pytest.fixture(scope="module")
def key():
    extracted = pdf_text.extract(KEY_PDF.read_bytes(), KEY_PDF.name)
    return answer_key_parser.parse_answer_key(extracted.lines)


def test_quiz_structure(parsed):
    extracted, questions, warnings = parsed

    assert extracted.title == "What Actually Is AI?"
    assert extracted.page_count == 14
    assert extracted.scanned_pages == []
    assert [q.number for q in questions] == list(range(1, 61))
    assert warnings == []


def test_every_question_has_four_clean_options(parsed):
    _, questions, _ = parsed

    assert {"".join(sorted(q.options)) for q in questions} == {"ABCD"}
    assert all(q.text for q in questions)
    assert all(all(text for text in q.options.values()) for q in questions)
    assert [q.number for q in questions if q.issues] == []


def test_a_known_question_is_extracted_intact(parsed):
    _, questions, _ = parsed
    first = questions[0]

    assert first.text.startswith("A university librarian uses two systems")
    assert first.text.endswith("better reflects what AI actually means?")
    assert first.options["B"] == (
        "Neither system, since a librarian is still available to help students in person"
    )


def test_key_covers_every_question_with_a_reason(key):
    entries, warnings = key

    assert sorted(entries) == list(range(1, 61))
    assert all(entry.explanation for entry in entries.values())
    assert warnings == [], "the key's two sections must agree with each other"


def test_merged_result_is_fully_answered(parsed, key):
    _, questions, _ = parsed
    entries, _ = key
    questions = [q.model_copy(deep=True) for q in questions]

    warnings = apply_key(questions, entries)

    assert warnings == []
    assert all(q.answer_source == "key" for q in questions)
    assert all(q.explanation_source == "key" for q in questions)
    assert dict(sorted(Counter(q.correct for q in questions).items())) == {
        "A": 17,
        "B": 17,
        "C": 13,
        "D": 13,
    }
    assert questions[0].correct == "A"
    assert questions[0].explanation == "Interprets open-ended request, not exact-match lookup"


def test_endpoint_end_to_end_with_both_samples():
    client = TestClient(app)
    response = client.post(
        "/parse",
        files={
            "quiz": (QUIZ_PDF.name, QUIZ_PDF.read_bytes(), "application/pdf"),
            "answer_key": (KEY_PDF.name, KEY_PDF.read_bytes(), "application/pdf"),
        },
    )
    assert response.status_code == 200

    body = response.json()
    assert body["title"] == "What Actually Is AI?"
    assert body["question_count"] == 60
    assert body["warnings"] == []
    assert body["pages"]["total"] == 14
    assert all(q["answer_source"] == "key" for q in body["questions"])
