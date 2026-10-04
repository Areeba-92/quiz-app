"""Quiz generation from a study PDF: chunking, validation and de-duplication.

No API calls here (those are in app/ai.py), so every rule can be tested on its own.

The work is split into chunks of a few pages so that each AI call stays far
inside Vercel's per-request time limit. The frontend asks for one chunk at a
time and then sends everything back to be de-duplicated and numbered.
"""

import math
import random
import re
from dataclasses import dataclass
from difflib import SequenceMatcher

from pydantic import ValidationError

from app.schemas import Question
from app.scoring import normalise_answer

# Pages per chunk, at most. Chunks are evened out, so most hold 3 or 4.
CHUNK_PAGES = 4

# Questions asked of one AI call. More than this makes one call slow and repetitive.
MAX_PER_CHUNK = 15

MAX_QUESTIONS = 50

LETTERS = ("A", "B", "C", "D")

# Stems at least this similar, after normalising, count as the same question.
DUPLICATE_RATIO = 0.85

# A label the model sometimes puts in front of an option despite being told not to.
_OPTION_LABEL = re.compile(r"^\s*\(?[A-Da-d]\s*[.):]\s+")


@dataclass
class Chunk:
    pages: list[int]
    text: str


def make_chunks(page_lines: list[list[str]], size: int = CHUNK_PAGES) -> list[Chunk]:
    """Group the pages that have text into chunks of at most `size`, as even as possible.

    Each page is marked "[Page N]" in the text, so the AI can say where a
    question came from.
    """
    pages = [(number, lines) for number, lines in enumerate(page_lines, start=1) if lines]
    if not pages:
        return []

    count = math.ceil(len(pages) / size)
    base, extra = divmod(len(pages), count)
    chunks: list[Chunk] = []
    start = 0
    for index in range(count):
        end = start + base + (1 if index < extra else 0)
        group = pages[start:end]
        text = "\n\n".join(f"[Page {number}]\n" + "\n".join(lines) for number, lines in group)
        chunks.append(Chunk(pages=[number for number, _ in group], text=text))
        start = end
    return chunks


def allocate(chunks: list[Chunk], total: int, cap: int = MAX_PER_CHUNK) -> list[int]:
    """Share `total` questions across chunks in proportion to how much text each has.

    Largest remainder, so the shares always add up to the total unless every
    chunk is at its cap: a short PDF cannot honestly carry many questions.
    """
    if not chunks or total <= 0:
        return [0] * len(chunks)

    total = min(total, cap * len(chunks))
    sizes = [max(1, len(chunk.text)) for chunk in chunks]
    whole = sum(sizes)
    exact = [total * size / whole for size in sizes]
    shares = [min(cap, math.floor(value)) for value in exact]

    # Hand out what is left, biggest remainder first, skipping chunks at the cap.
    order = sorted(range(len(chunks)), key=lambda i: exact[i] - math.floor(exact[i]), reverse=True)
    while sum(shares) < total:
        for i in order:
            if sum(shares) == total:
                break
            if shares[i] < cap:
                shares[i] += 1
    return shares


def _clean_option(value: object) -> str:
    return _OPTION_LABEL.sub("", str(value)).strip()


def validate_items(items: list, pages: list[int]) -> tuple[list[Question], int]:
    """AI reply items -> questions in the shared schema. Returns (questions, skipped).

    An item is skipped, never repaired, when it breaks a rule: text present,
    exactly four distinct options, one correct letter among them, an
    explanation, and a source page that is in the chunk it was written from.
    Questions come back numbered 0; numbering happens after de-duplication.
    """
    questions: list[Question] = []
    skipped = 0
    for item in items:
        try:
            text = str(item["question"]).strip()
            options = [_clean_option(option) for option in item["options"]]
            correct = normalise_answer(str(item["correct"]))
            explanation = str(item["explanation"]).strip()
            page = int(item["source_page"])
        except (KeyError, TypeError, ValueError):
            skipped += 1
            continue

        distinct = {option.casefold() for option in options}
        if (
            not text
            or len(options) != len(LETTERS)
            or not all(options)
            or len(distinct) != len(LETTERS)
            or correct not in LETTERS
            or not explanation
            or page not in pages
        ):
            skipped += 1
            continue

        try:
            questions.append(
                Question(
                    number=0,
                    text=text,
                    options=dict(zip(LETTERS, options)),
                    correct=correct,
                    answer_source="ai",
                    explanation=explanation,
                    explanation_source="ai",
                    generated=True,
                    source_page=page,
                )
            )
        except ValidationError:
            skipped += 1
    return questions, skipped


def shuffle_options(questions: list[Question], rng: random.Random | None = None) -> list[Question]:
    """Move each correct option to a new letter, spread evenly over A to D.

    Models put the right answer first far too often, which makes a quiz
    guessable. Across a batch every letter is correct about equally often; the
    other three options are shuffled around it. Option texts never change.
    """
    rng = rng or random.Random()
    # Whole rounds of A to D, each in a fresh random order, so a batch smaller
    # than four can land on any letters, not always the first ones.
    targets: list[str] = []
    while len(targets) < len(questions):
        targets += rng.sample(LETTERS, len(LETTERS))
    targets = targets[: len(questions)]

    shuffled: list[Question] = []
    for question, target in zip(questions, targets):
        texts = [question.options[letter] for letter in LETTERS]
        right = texts.pop(LETTERS.index(question.correct))
        rng.shuffle(texts)
        texts.insert(LETTERS.index(target), right)
        shuffled.append(
            question.model_copy(update={"options": dict(zip(LETTERS, texts)), "correct": target})
        )
    return shuffled


def _stem(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", text.lower()).split())


def dedupe(questions: list[Question], ratio: float = DUPLICATE_RATIO) -> tuple[list[Question], int]:
    """Drop questions whose stem nearly matches an earlier one. Returns (kept, removed).

    The first copy wins, so questions stay in page order.
    """
    kept: list[Question] = []
    stems: list[str] = []
    removed = 0
    for question in questions:
        stem = _stem(question.text)
        if any(
            stem == seen or SequenceMatcher(None, stem, seen).ratio() >= ratio for seen in stems
        ):
            removed += 1
            continue
        kept.append(question)
        stems.append(stem)
    return kept, removed


def renumber(questions: list[Question]) -> list[Question]:
    return [question.model_copy(update={"number": n}) for n, question in enumerate(questions, start=1)]
