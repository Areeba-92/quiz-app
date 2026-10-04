"""Quiz generation: chunking, validation, de-duplication, the retry, and the endpoints.

Nothing here calls the real API.
"""

from types import SimpleNamespace

import httpx
import openai
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import ai, generate
from app.main import app
from app.schemas import Question
from tests.conftest import make_pdf


def pages_of(count: int, text: str = "Some study text.") -> list[list[str]]:
    return [[f"{text} {n}"] for n in range(1, count + 1)]


def item(**changes) -> dict:
    base = {
        "question": "What does the material say a model learns from?",
        "options": ["Examples", "Fixed rules", "Random noise", "Nothing"],
        "correct": "A",
        "explanation": "Page 2 says models learn patterns from examples.",
        "source_page": 2,
    }
    return base | changes


def generated(text: str, page: int = 1) -> Question:
    return Question(
        number=0,
        text=text,
        options={"A": "a", "B": "b", "C": "c", "D": "d"},
        correct="A",
        answer_source="ai",
        generated=True,
        source_page=page,
    )


# --- chunking --------------------------------------------------------------


@pytest.mark.parametrize(
    ("page_count", "sizes"),
    [(1, [1]), (4, [4]), (5, [3, 2]), (6, [3, 3]), (9, [3, 3, 3]), (13, [4, 3, 3, 3])],
)
def test_chunks_hold_at_most_four_pages_and_are_even(page_count, sizes):
    chunks = generate.make_chunks(pages_of(page_count))
    assert [len(c.pages) for c in chunks] == sizes
    # Every page is used once, in order.
    assert [p for c in chunks for p in c.pages] == list(range(1, page_count + 1))


def test_pages_without_text_are_left_out_but_keep_their_numbers():
    page_lines = [["Intro"], [], ["Middle"], [], ["End"]]
    [chunk] = generate.make_chunks(page_lines)
    assert chunk.pages == [1, 3, 5]
    assert "[Page 3]\nMiddle" in chunk.text
    assert "[Page 2]" not in chunk.text


def test_no_text_at_all_gives_no_chunks():
    assert generate.make_chunks([[], []]) == []


def test_questions_are_shared_by_text_length_and_add_up():
    chunks = [
        generate.Chunk(pages=[1], text="x" * 3000),
        generate.Chunk(pages=[2], text="x" * 1000),
    ]
    assert generate.allocate(chunks, 8) == [6, 2]
    assert sum(generate.allocate(chunks, 7)) == 7


def test_fewer_questions_than_chunks_go_to_the_longest_text():
    chunks = [generate.Chunk(pages=[n], text="x" * size) for n, size in enumerate([100, 900, 500])]
    assert generate.allocate(chunks, 1) == [0, 1, 0]


def test_a_short_pdf_is_capped_per_chunk():
    chunks = [generate.Chunk(pages=[1], text="tiny")]
    assert generate.allocate(chunks, 40) == [generate.MAX_PER_CHUNK]


# --- validation ------------------------------------------------------------


def test_a_good_item_becomes_a_generated_ai_question():
    [question], skipped = generate.validate_items([item(correct="b")], pages=[1, 2])
    assert skipped == 0
    assert question.options == {"A": "Examples", "B": "Fixed rules", "C": "Random noise", "D": "Nothing"}
    assert question.correct == "B"
    assert question.answer_source == "ai"
    assert question.explanation_source == "ai"
    assert question.generated is True
    assert question.source_page == 2


def test_letter_labels_on_options_are_removed():
    labelled = item(options=["A. Examples", "(B) Fixed rules", "c) Random noise", "D: Nothing"])
    [question], _ = generate.validate_items([labelled], pages=[2])
    assert list(question.options.values()) == ["Examples", "Fixed rules", "Random noise", "Nothing"]


@pytest.mark.parametrize(
    "bad",
    [
        item(question="  "),
        item(options=["Examples", "Fixed rules", "Random noise"]),
        item(options=["Examples", "Fixed rules", "Random noise", "Nothing", "Extra"]),
        item(options=["Examples", "examples", "Random noise", "Nothing"]),
        item(options=["Examples", "", "Random noise", "Nothing"]),
        item(correct="E"),
        item(correct=""),
        item(explanation=""),
        item(source_page=7),
        item(source_page="not a number"),
        {"question": "Missing everything else"},
        "not even an object",
    ],
)
def test_items_that_break_a_rule_are_skipped_and_counted(bad):
    questions, skipped = generate.validate_items([item(), bad], pages=[1, 2])
    assert len(questions) == 1
    assert skipped == 1


# --- de-duplication --------------------------------------------------------


def test_near_duplicate_stems_are_removed_and_the_first_is_kept():
    questions = [
        generated("What does a model learn from?", page=1),
        generated("What does a model learn from?", page=5),
        generated("What does the model learn from", page=6),
        generated("Which of these is a fixed rule system?", page=2),
    ]
    kept, removed = generate.dedupe(questions)
    assert removed == 2
    assert [q.source_page for q in kept] == [1, 2]


def test_different_questions_about_one_topic_are_kept():
    questions = [
        generated("A shop uses rules to flag fraud. What kind of system is this?"),
        generated("A shop trains on past fraud cases to flag new ones. What kind of system is this?"),
    ]
    kept, removed = generate.dedupe(questions)
    assert removed == 0
    assert len(kept) == 2


def test_renumber_counts_from_one():
    numbered = generate.renumber([generated("one"), generated("two")])
    assert [q.number for q in numbered] == [1, 2]


# --- the AI call and its retry --------------------------------------------


class FakeClient:
    """Each call takes the next reply: a list of items, None, or an exception to raise."""

    def __init__(self, *replies):
        self.replies = list(replies)
        self.calls: list[str] = []
        self.responses = SimpleNamespace(parse=self._parse)

    def _parse(self, *, model, instructions, input, text_format):
        self.calls.append(input)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        parsed = None if reply is None else text_format(questions=reply)
        return SimpleNamespace(output_parsed=parsed)


def bad_json() -> ValidationError:
    try:
        ai._Generated.model_validate_json("{not json")
    except ValidationError as exc:
        return exc
    raise AssertionError("expected invalid JSON")


@pytest.fixture
def model(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "test-model")


def test_generate_sends_settings_and_material(model):
    client = FakeClient([item()])
    items = ai.generate_questions("[Page 2]\nText", 3, "hard", True, client=client)

    assert items == [item()]
    [prompt] = client.calls
    assert "Write 3 questions." in prompt
    assert "Hard:" in prompt
    assert "scenario-based" in prompt
    assert "[Page 2]\nText" in prompt


def test_invalid_json_is_retried_once(model):
    client = FakeClient(bad_json(), [item()])
    assert ai.generate_questions("text", 1, "easy", False, client=client) == [item()]
    assert len(client.calls) == 2


def test_an_empty_reply_is_retried_too(model):
    client = FakeClient(None, [item()])
    assert ai.generate_questions("text", 1, "easy", False, client=client) == [item()]


def test_invalid_json_twice_fails_with_a_safe_message(model):
    client = FakeClient(bad_json(), bad_json())
    with pytest.raises(ai.GenerateFailed, match="not valid JSON"):
        ai.generate_questions("text", 1, "easy", False, client=client)
    assert len(client.calls) == 2


def test_an_api_error_is_not_retried_and_never_echoes_its_message(model):
    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
    response = httpx.Response(401, request=request)
    error = openai.AuthenticationError("Incorrect API key provided: sk-secret", response=response, body=None)
    client = FakeClient(error)

    with pytest.raises(ai.GenerateFailed) as caught:
        ai.generate_questions("text", 1, "easy", False, client=client)
    assert "sk-secret" not in str(caught.value)
    assert "HTTP 401" in str(caught.value)
    assert len(client.calls) == 1


# --- endpoints -------------------------------------------------------------


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def configured(monkeypatch):
    monkeypatch.setattr(ai, "is_configured", lambda: True)


STUDY = ["Machine learning finds patterns in examples. " * 5, "Rule systems follow fixed rules. " * 5]


def test_plan_splits_the_pdf_and_shares_the_questions(client, configured):
    response = client.post(
        "/generate-quiz",
        files={"pdf": ("notes.pdf", make_pdf(STUDY), "application/pdf")},
        data={"num_questions": "6", "difficulty": "hard", "scenario_based": "true"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["requested"] == body["planned"] == 6
    [chunk] = body["chunks"]
    assert chunk["pages"] == [1, 2]
    assert chunk["count"] == 6
    assert "[Page 2]" in chunk["text"]


def test_plan_needs_openai(client):
    response = client.post(
        "/generate-quiz", files={"pdf": ("notes.pdf", make_pdf(STUDY), "application/pdf")}
    )
    assert response.status_code == 503


def test_plan_rejects_a_pdf_with_no_text(client, configured, monkeypatch):
    monkeypatch.setattr(ai, "transcribe_pages", lambda images: ["unreadable"] * len(images))
    response = client.post(
        "/generate-quiz", files={"pdf": ("blank.pdf", make_pdf([""]), "application/pdf")}
    )
    assert response.status_code == 422


def test_chunk_returns_valid_questions_and_counts_the_rest(client, configured, monkeypatch):
    monkeypatch.setattr(ai, "generate_questions", lambda *args: [item(), item(correct="Z")])
    response = client.post(
        "/generate-quiz/chunk", json={"pages": [1, 2], "text": "[Page 1]\nText", "count": 2}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["skipped"] == 1
    [question] = body["questions"]
    assert question["generated"] is True
    assert question["answer_source"] == "ai"


def test_chunk_failure_is_a_502_with_the_safe_message(client, configured, monkeypatch):
    def fail(*args):
        raise ai.GenerateFailed("The OpenAI request failed: RateLimitError (HTTP 429)")

    monkeypatch.setattr(ai, "generate_questions", fail)
    response = client.post("/generate-quiz/chunk", json={"pages": [1], "text": "t", "count": 1})
    assert response.status_code == 502
    assert "HTTP 429" in response.json()["detail"]


def test_finish_dedupes_numbers_and_reports(client):
    questions = [generated("Same question?").model_dump()] * 2 + [generated("Other question?").model_dump()]
    response = client.post(
        "/generate-quiz/finish",
        json={
            "title": "Notes",
            "pages": {"total": 2, "text_pages": 2},
            "questions": questions,
            "requested": 5,
            "skipped": 1,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["question_count"] == 2
    assert [q["number"] for q in body["questions"]] == [1, 2]
    codes = [w["code"] for w in body["warnings"]]
    assert codes == ["generate_skipped", "generate_duplicates", "generate_fewer"]


def test_finish_with_no_questions_is_rejected(client):
    response = client.post(
        "/generate-quiz/finish",
        json={"title": "Notes", "pages": {"total": 1, "text_pages": 1}, "questions": [], "requested": 3},
    )
    assert response.status_code == 422
