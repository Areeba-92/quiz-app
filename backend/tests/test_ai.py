"""ai.py against a fake client: nothing here calls the real API."""

from types import SimpleNamespace

import httpx
import openai
import pytest

from app import ai
from app.schemas import Question


def question(number: int, correct: str | None = None) -> Question:
    return Question(
        number=number,
        text=f"Scenario for item {number}",
        options={"A": "first", "B": "second", "C": "third", "D": "fourth"},
        correct=correct,
        answer_source="key" if correct else None,
    )


class FakeClient:
    """Stands in for OpenAI(). `reply` maps a batch of questions to answers."""

    def __init__(self, reply):
        self.calls: list[str] = []
        self.responses = SimpleNamespace(parse=self._parse)
        self._reply = reply

    def _parse(self, *, model, instructions, input, text_format):
        self.calls.append(input)
        answers = self._reply(input)
        if isinstance(answers, Exception):
            raise answers
        return SimpleNamespace(output_parsed=text_format(answers=answers))


def numbers_in(prompt: str) -> list[int]:
    return [int(line.split()[1].rstrip(":")) for line in prompt.splitlines() if line.startswith("Question ")]


def answer_all(letter: str):
    return lambda prompt: [
        {"number": n, "answer": letter, "reason": "Because it fits."} for n in numbers_in(prompt)
    ]


@pytest.fixture(autouse=True)
def model(monkeypatch):
    monkeypatch.setenv("OPENAI_MODEL", "test-model")


def test_unanswered_questions_get_ai_answers():
    questions = [question(1), question(2)]
    warnings = ai.answer_questions(questions, client=FakeClient(answer_all("b")))

    assert warnings == []
    assert [q.correct for q in questions] == ["B", "B"]
    assert {q.answer_source for q in questions} == {"ai"}
    assert {q.explanation_source for q in questions} == {"ai"}
    assert questions[0].explanation == "Because it fits."


def test_key_backed_questions_are_never_sent_or_changed():
    questions = [question(1, correct="D"), question(2)]
    client = FakeClient(answer_all("A"))
    ai.answer_questions(questions, client=client)

    assert numbers_in(client.calls[0]) == [2]
    assert (questions[0].correct, questions[0].answer_source) == ("D", "key")


def test_answers_are_matched_by_number_not_position():
    questions = [question(1), question(2)]
    reply = lambda prompt: [
        {"number": 2, "answer": "C", "reason": "Second."},
        {"number": 1, "answer": "A", "reason": "First."},
    ]
    ai.answer_questions(questions, client=FakeClient(reply))

    assert [q.correct for q in questions] == ["A", "C"]


def test_a_letter_that_is_not_an_option_is_left_unanswered():
    questions = [question(1), question(2)]
    reply = lambda prompt: [
        {"number": 1, "answer": "E", "reason": "No such option."},
        {"number": 2, "answer": "B", "reason": "Fine."},
    ]
    warnings = ai.answer_questions(questions, client=FakeClient(reply))

    assert questions[0].correct is None
    assert "ai_no_answer" in questions[0].issues
    assert questions[1].correct == "B"
    assert [w.code for w in warnings] == ["ai_no_answer"]


def test_a_missing_reply_entry_is_reported():
    questions = [question(1), question(2)]
    reply = lambda prompt: [{"number": 1, "answer": "A", "reason": "Only one."}]
    warnings = ai.answer_questions(questions, client=FakeClient(reply))

    assert questions[1].correct is None
    assert "2" in warnings[0].message


def test_questions_are_sent_in_batches():
    questions = [question(n) for n in range(1, 26)]
    client = FakeClient(answer_all("A"))
    ai.answer_questions(questions, client=client)

    assert sorted(len(numbers_in(call)) for call in client.calls) == [5, 10, 10]
    assert all(q.correct == "A" for q in questions)


def test_an_api_failure_leaves_questions_unanswered_and_says_so():
    error = openai.APIConnectionError(request=httpx.Request("POST", "https://example.invalid"))
    questions = [question(1)]
    warnings = ai.answer_questions(questions, client=FakeClient(lambda prompt: error))

    assert questions[0].correct is None
    assert {w.code for w in warnings} == {"ai_failed", "ai_no_answer"}


def test_is_configured_needs_both_key_and_model(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    assert not ai.is_configured()
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    assert ai.is_configured()
    monkeypatch.delenv("OPENAI_MODEL")
    assert not ai.is_configured()


class FakeVisionClient:
    def __init__(self, reply):
        self.calls = 0
        self.responses = SimpleNamespace(parse=self._parse)
        self._reply = reply

    def _parse(self, *, model, instructions, input, text_format):
        self.calls += 1
        image = input[0]["content"][0]
        assert image["type"] == "input_image"
        assert image["image_url"].startswith("data:image/png;base64,")
        result = self._reply(image["image_url"])
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(output_parsed=text_format(**result))


def test_pages_are_transcribed_in_order():
    import base64

    images = [b"page-one", b"page-two"]
    reply = lambda url: {
        "lines": [base64.b64decode(url.split(",", 1)[1]).decode()],
        "unclear": False,
    }
    pages = ai.transcribe_pages(images, client=FakeVisionClient(reply))

    assert [page.lines for page in pages] == [["page-one"], ["page-two"]]


def test_a_failed_page_becomes_a_safe_error_message():
    leaked = "Incorrect API key provided: sk-abc123secret"
    error = openai.AuthenticationError(
        leaked,
        response=httpx.Response(401, request=httpx.Request("POST", "https://example.invalid")),
        body=None,
    )
    pages = ai.transcribe_pages([b"img"], client=FakeVisionClient(lambda url: error))

    assert pages == ["AuthenticationError (HTTP 401)"]


def test_an_answering_failure_never_leaks_the_key():
    leaked = "Incorrect API key provided: sk-abc123secret"
    error = openai.AuthenticationError(
        leaked,
        response=httpx.Response(401, request=httpx.Request("POST", "https://example.invalid")),
        body=None,
    )
    warnings = ai.answer_questions([question(1)], client=FakeClient(lambda prompt: error))

    assert not any("sk-" in w.message for w in warnings)
    assert "HTTP 401" in warnings[0].message


class FakeExplainClient:
    """Explains every question it is sent, unless `reply` says otherwise."""

    def __init__(self, reply=None):
        self.calls: list[str] = []
        self.responses = SimpleNamespace(parse=self._parse)
        self._reply = reply or (
            lambda prompt: [{"number": n, "reason": f"Why {n} is right."} for n in numbers_in(prompt)]
        )

    def _parse(self, *, model, instructions, input, text_format):
        self.calls.append(input)
        result = self._reply(input)
        if isinstance(result, Exception):
            raise result
        return SimpleNamespace(output_parsed=text_format(explanations=result))


def test_key_answers_without_a_reason_get_an_ai_explanation():
    questions = [question(1, correct="B"), question(2, correct="D")]
    client = FakeExplainClient()
    warnings = ai.explain_answers(questions, client=client)

    assert warnings == []
    assert [q.explanation for q in questions] == ["Why 1 is right.", "Why 2 is right."]
    assert {q.explanation_source for q in questions} == {"ai"}
    # The answer stays the key's, and the prompt tells the model what it is.
    assert [(q.correct, q.answer_source) for q in questions] == [("B", "key"), ("D", "key")]
    assert "Correct answer: B" in client.calls[0]


def test_reasons_from_the_key_are_kept_and_not_sent():
    with_reason = question(1, correct="A")
    with_reason.explanation, with_reason.explanation_source = "From the key.", "key"
    ai_answered = question(2)
    ai_answered.correct, ai_answered.answer_source = "C", "ai"
    unanswered = question(3)
    client = FakeExplainClient()

    assert ai.explain_answers([with_reason, ai_answered, unanswered], client=client) == []
    assert client.calls == []
    assert with_reason.explanation == "From the key."


def test_explanations_are_matched_by_number():
    questions = [question(1, correct="A"), question(2, correct="B")]
    reply = lambda prompt: [{"number": 2, "reason": "Second."}, {"number": 1, "reason": "First."}]
    ai.explain_answers(questions, client=FakeExplainClient(reply))

    assert [q.explanation for q in questions] == ["First.", "Second."]


def test_a_failed_explanation_call_never_touches_the_answers():
    error = openai.APIConnectionError(request=httpx.Request("POST", "https://example.invalid"))
    questions = [question(1, correct="A")]
    warnings = ai.explain_answers(questions, client=FakeExplainClient(lambda prompt: error))

    assert (questions[0].correct, questions[0].explanation) == ("A", None)
    assert [w.code for w in warnings] == ["ai_explain_failed"]
    assert "not affected" in warnings[0].message


def test_double_check_asks_without_revealing_the_key():
    client = FakeClient(answer_all("c"))
    letter, reason = ai.check_answer(question(7, correct="B"), client=client)

    assert (letter, reason) == ("C", "Because it fits.")
    assert "Correct answer" not in client.calls[0]
    assert numbers_in(client.calls[0]) == [7]


def test_double_check_rejects_a_letter_that_is_not_an_option():
    client = FakeClient(lambda prompt: [{"number": 7, "answer": "E", "reason": "?"}])
    with pytest.raises(ai.CheckFailed, match="no usable answer"):
        ai.check_answer(question(7, correct="B"), client=client)


def test_a_double_check_failure_never_leaks_the_key():
    error = openai.AuthenticationError(
        "Incorrect API key provided: sk-abc123secret",
        response=httpx.Response(401, request=httpx.Request("POST", "https://example.invalid")),
        body=None,
    )
    with pytest.raises(ai.CheckFailed) as caught:
        ai.check_answer(question(7, correct="B"), client=FakeClient(lambda prompt: error))
    assert "sk-" not in str(caught.value)
    assert "HTTP 401" in str(caught.value)
