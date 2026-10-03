"""All OpenAI calls. Nothing else in the app talks to the API.

Four jobs:
- No answer key: the model picks an answer for each question, and every answer
  it picks is marked `answer_source = "ai"` so the app can badge it and keep it
  out of the key-backed score.
- Key with letters only: the model writes a short reason for the key's answer.
  It never changes the answer; only `explanation_source` becomes "ai".
- Double check: during the quiz, the model answers one question on its own,
  without being told the key's answer, as an independent second opinion.
- Scanned pages: the model transcribes each page image into text lines, which
  then go through the same parsers as a text PDF.

The key and the model ID are read from backend/.env, never hardcoded.
"""

import base64
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError
from pydantic import BaseModel

from app.parsers.pdf_text import PageText
from app.schemas import ParseWarning, Question
from app.scoring import normalise_answer

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# Questions per API call. Small enough that one bad reply loses little,
# large enough that a 60-question paper is only six calls.
BATCH_SIZE = 10
MAX_PARALLEL_CALLS = 6

INSTRUCTIONS = """You answer multiple-choice exam questions.
For each question, pick the single best option letter from the options given.
Give a short reason, one or two sentences, saying why that option is right.
Answer every question, and copy each question's number exactly as given."""


EXPLAIN_INSTRUCTIONS = """You explain answers to multiple-choice exam questions.
Each question comes with its correct answer, taken from the official answer key.
Treat that answer as correct. Do not question, change or second-guess it.
For each question, write one or two sentences saying why that option is right.
Explain every question, and copy each question's number exactly as given."""


TRANSCRIBE_INSTRUCTIONS = """You transcribe one scanned page of an exam paper or answer key.
Copy every printed or handwritten line of text exactly as it appears, top to bottom, one entry per line.
Keep question numbers, option letters and punctuation exactly as written.
Do not answer, correct, summarise, translate or add anything.
Ignore tick marks and stray marks that are not text.
Set unclear to true if any part of the page could not be read with confidence."""


class _Answer(BaseModel):
    number: int
    answer: str
    reason: str


class _Batch(BaseModel):
    answers: list[_Answer]


class _Explanation(BaseModel):
    number: int
    reason: str


class _Explained(BaseModel):
    explanations: list[_Explanation]


class _Page(BaseModel):
    lines: list[str]
    unclear: bool


def _safe_error(exc: Exception) -> str:
    """Never the raw message: an authentication error echoes part of the key."""
    status = getattr(exc, "status_code", None)
    return type(exc).__name__ + (f" (HTTP {status})" if status else "")


def is_configured() -> bool:
    return bool(os.environ.get("OPENAI_API_KEY") and os.environ.get("OPENAI_MODEL"))


def _render(batch: list[Question], with_answer: bool = False) -> str:
    blocks = []
    for question in batch:
        options = "\n".join(f"{letter}. {text}" for letter, text in sorted(question.options.items()))
        block = f"Question {question.number}:\n{question.text}\n{options}"
        if with_answer:
            block += f"\nCorrect answer: {question.correct}"
        blocks.append(block)
    return "\n\n".join(blocks)


def _batches(questions: list[Question]) -> list[list[Question]]:
    return [questions[i : i + BATCH_SIZE] for i in range(0, len(questions), BATCH_SIZE)]


def _ask_all(client: OpenAI, instructions: str, inputs: list[str], text_format: type[BaseModel]) -> list:
    """One structured call per input, in parallel. A failed call comes back as its OpenAIError."""
    model = os.environ["OPENAI_MODEL"]

    def run(text: str):
        try:
            response = client.responses.parse(
                model=model, instructions=instructions, input=text, text_format=text_format
            )
            return response.output_parsed
        except OpenAIError as exc:
            return exc

    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_CALLS, len(inputs))) as pool:
        return list(pool.map(run, inputs))


def answer_questions(questions: list[Question], client: OpenAI | None = None) -> list[ParseWarning]:
    """Fill in `correct` for every unanswered question, in place. Returns warnings."""
    pending = [q for q in questions if q.correct is None and len(q.options) >= 2]
    if not pending:
        return []

    batches = _batches(pending)
    replies = _ask_all(client or OpenAI(), INSTRUCTIONS, [_render(b) for b in batches], _Batch)

    warnings: list[ParseWarning] = []
    failures: list[str] = []
    unanswered: list[int] = []

    for batch, reply in zip(batches, replies):
        if isinstance(reply, OpenAIError):
            failures.append(_safe_error(reply))
            unanswered += [q.number for q in batch]
            continue

        # Matched by question number, never by position in the reply.
        by_number = {item.number: item for item in reply.answers} if reply else {}
        for question in batch:
            item = by_number.get(question.number)
            letter = normalise_answer(item.answer) if item else None
            if letter not in question.options:
                unanswered.append(question.number)
                question.issues.append("ai_no_answer")
                continue
            question.correct = letter
            question.answer_source = "ai"
            reason = item.reason.strip()
            if reason:
                question.explanation = reason
                question.explanation_source = "ai"

    if failures:
        warnings.append(
            ParseWarning(
                code="ai_failed",
                message=f"The OpenAI request failed: {failures[0]}",
            )
        )
    if unanswered:
        warnings.append(
            ParseWarning(
                code="ai_no_answer",
                message=(
                    f"The AI gave no usable answer for {len(unanswered)} question"
                    f"{'' if len(unanswered) == 1 else 's'}: "
                    f"{', '.join(str(n) for n in sorted(unanswered))}. They were left unanswered."
                ),
            )
        )
    return warnings


class CheckFailed(Exception):
    """The double-check call failed. The message is safe to show."""


def check_answer(question: Question, client: OpenAI | None = None) -> tuple[str, str]:
    """OpenAI's own pick for one question, and its reason.

    The key's answer is deliberately left out of the prompt: a second opinion
    that has been told the answer is not a second opinion.
    """
    blind = question.model_copy(update={"correct": None})
    [reply] = _ask_all(client or OpenAI(), INSTRUCTIONS, [_render([blind])], _Batch)
    if isinstance(reply, OpenAIError):
        raise CheckFailed(f"The OpenAI request failed: {_safe_error(reply)}")

    item = next((a for a in reply.answers if a.number == question.number), None) if reply else None
    letter = normalise_answer(item.answer) if item else None
    if letter not in question.options:
        raise CheckFailed("The AI gave no usable answer for this question.")
    return letter, item.reason.strip()


def explain_answers(questions: list[Question], client: OpenAI | None = None) -> list[ParseWarning]:
    """Write a reason for every key-backed answer that has none, in place. Returns warnings.

    Only `explanation` changes. The key's answer is never touched, whatever the
    model says.
    """
    pending = [
        q for q in questions if q.answer_source == "key" and q.correct and not q.explanation
    ]
    if not pending:
        return []

    batches = _batches(pending)
    inputs = [_render(b, with_answer=True) for b in batches]
    replies = _ask_all(client or OpenAI(), EXPLAIN_INSTRUCTIONS, inputs, _Explained)

    failures: list[str] = []
    for batch, reply in zip(batches, replies):
        if isinstance(reply, OpenAIError):
            failures.append(_safe_error(reply))
            continue
        # Matched by question number, never by position in the reply.
        by_number = {item.number: item for item in reply.explanations} if reply else {}
        for question in batch:
            item = by_number.get(question.number)
            reason = item.reason.strip() if item else ""
            if reason:
                question.explanation = reason
                question.explanation_source = "ai"

    if not failures:
        return []
    return [
        ParseWarning(
            code="ai_explain_failed",
            message=(
                f"Some explanations could not be written: {failures[0]}. "
                "The answers from the key are not affected."
            ),
        )
    ]


def _transcribe(client: OpenAI, model: str, image: bytes) -> _Page | None:
    data_url = "data:image/png;base64," + base64.b64encode(image).decode("ascii")
    response = client.responses.parse(
        model=model,
        instructions=TRANSCRIBE_INSTRUCTIONS,
        input=[
            {
                "role": "user",
                "content": [{"type": "input_image", "image_url": data_url, "detail": "high"}],
            }
        ],
        text_format=_Page,
    )
    return response.output_parsed


def transcribe_pages(images: list[bytes], client: OpenAI | None = None) -> list[PageText | str]:
    """PNG page images -> text, in the same order. A page that fails becomes an error string."""
    if not images:
        return []

    client = client or OpenAI()
    model = os.environ["OPENAI_MODEL"]

    def run(image: bytes) -> PageText | str:
        try:
            page = _transcribe(client, model, image)
        except OpenAIError as exc:
            return _safe_error(exc)
        if page is None:
            return "the reply could not be read"
        return PageText(lines=page.lines, unclear=page.unclear)

    with ThreadPoolExecutor(max_workers=min(MAX_PARALLEL_CALLS, len(images))) as pool:
        return list(pool.map(run, images))
