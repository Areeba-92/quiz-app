"""Text lines -> Question objects.

Pure text in, objects out: this module knows nothing about PDFs, so the vision
path in phase 4 can reuse it unchanged and almost every test here needs no PDF.
"""

import re

from app.schemas import ParseWarning, Question

LETTERS = "ABCDE"

# "Q1." / "Question 1:" / "Q 1 -"
Q_PREFIXED = re.compile(r"^Q(?:uestion)?\s*\.?\s*(\d{1,3})(?!\d)\s*[.):\-]?\s*(.*)$", re.I)
# "1." / "1)" -- deliberately stricter, since a bare number is easy to hit by accident.
Q_BARE = re.compile(r"^(\d{1,3})(?!\d)\s*[.)]\s+(.*)$")

# "A. text" / "(A) text" / "a) text"
OPTION_INLINE = re.compile(r"^\(?([A-Ea-e])\)?\s*[.)]\s+(.+)$")
# A marker alone on its line, with the text following on later lines.
OPTION_ALONE = re.compile(r"^\(?([A-Ea-e])\)?\s*[.)]?\s*$")
# For splitting several options that share one line.
INLINE_MARKER = re.compile(r"(?<![A-Za-z0-9])\(?([A-Ea-e])\)?[.)]\s+")

# How far the numbering may jump forward before we stop believing it.
MAX_NUMBER_SKIP = 3
# How many option letters may be missing before we stop believing a marker.
MAX_LETTER_SKIP = 2

MIN_STEM_CHARS = 10


class _Draft:
    __slots__ = ("number", "stem", "options", "order", "issues")

    def __init__(self, number: int, stem: str):
        self.number = number
        self.stem: list[str] = [stem] if stem else []
        self.options: dict[str, list[str]] = {}
        self.order: list[str] = []
        self.issues: list[str] = []

    def add_option(self, letter: str, text: str) -> None:
        self.options[letter] = [text] if text else []
        self.order.append(letter)

    def finish(self) -> Question:
        options = {letter: " ".join(parts).strip() for letter, parts in self.options.items()}
        text = " ".join(self.stem).strip()
        issues = list(self.issues)

        if not text:
            issues.append("empty_stem")
        elif len(text) < MIN_STEM_CHARS:
            issues.append("short_stem")

        if not options:
            issues.append("no_options")
        elif len(options) < 2:
            issues.append("too_few_options")

        expected = list(LETTERS[: len(self.order)])
        if self.order and self.order != expected:
            issues.append("non_contiguous_options")

        for letter, value in options.items():
            if not value:
                issues.append(f"empty_option_{letter}")

        return Question(number=self.number, text=text, options=options, issues=issues)


def _split_shared_line(line: str, expected_index: int) -> list[tuple[str, str]] | None:
    """Split "A. foo  B. bar" into separate options, but only when unambiguous."""
    matches = list(INLINE_MARKER.finditer(line))
    if len(matches) < 2:
        return None

    letters = [m.group(1).upper() for m in matches]
    wanted = list(LETTERS[expected_index : expected_index + len(letters)])
    if letters != wanted:
        return None

    parts: list[tuple[str, str]] = []
    for position, match in enumerate(matches):
        end = matches[position + 1].start() if position + 1 < len(matches) else len(line)
        parts.append((letters[position], line[match.end() : end].strip()))
    return parts


def _match_question(line: str, style: str | None) -> tuple[int, str] | None:
    if style in (None, "prefixed"):
        match = Q_PREFIXED.match(line)
        if match:
            return int(match.group(1)), match.group(2).strip()
    if style in (None, "bare"):
        match = Q_BARE.match(line)
        if match:
            return int(match.group(1)), match.group(2).strip()
    return None


def parse_questions(lines: list[str]) -> tuple[list[Question], list[ParseWarning]]:
    questions: list[Question] = []
    warnings: list[ParseWarning] = []
    draft: _Draft | None = None
    style: str | None = None
    last_number: int | None = None

    def flush() -> None:
        nonlocal draft
        if draft is not None:
            questions.append(draft.finish())
            draft = None

    for raw in lines:
        line = raw.strip()
        if not line:
            continue

        candidate = _match_question(line, style)
        if candidate is not None:
            number, stem = candidate
            # Monotonic guard: this is what stops a scenario containing
            # "...scored 3. He then..." from being read as question 3.
            accepted = last_number is None or last_number < number <= last_number + MAX_NUMBER_SKIP
            if accepted:
                if last_number is not None and number > last_number + 1:
                    warnings.append(
                        ParseWarning(
                            code="question_number_gap",
                            message=f"Numbering jumps from {last_number} to {number}.",
                            question_number=number,
                        )
                    )
                flush()
                if style is None:
                    style = "prefixed" if Q_PREFIXED.match(line) else "bare"
                draft = _Draft(number, stem)
                last_number = number
                continue

        if draft is None:
            continue  # title or other preamble before the first question

        expected_index = len(draft.order)

        shared = _split_shared_line(line, expected_index)
        if shared is not None:
            for letter, text in shared:
                draft.add_option(letter, text)
            continue

        option = OPTION_INLINE.match(line) or OPTION_ALONE.match(line)
        if option is not None and expected_index < len(LETTERS):
            letter = option.group(1).upper()
            index = LETTERS.find(letter)
            text = option.group(2).strip() if option.re is OPTION_INLINE else ""
            # Sequential guard: stops "B.P. was 140/90" becoming option B.
            if letter not in draft.options and expected_index <= index <= expected_index + MAX_LETTER_SKIP:
                if index > expected_index:
                    missing = "".join(LETTERS[expected_index:index])
                    draft.issues.append(f"missing_option_{missing}")
                draft.add_option(letter, text)
                continue

        # Anything else continues whatever is currently open. This is what
        # reassembles wrapped stems and wrapped option text.
        if draft.order:
            draft.options[draft.order[-1]].append(line)
        else:
            draft.stem.append(line)

    flush()

    seen: dict[int, int] = {}
    for question in questions:
        seen[question.number] = seen.get(question.number, 0) + 1
    for number, count in sorted(seen.items()):
        if count > 1:
            warnings.append(
                ParseWarning(
                    code="duplicate_question_number",
                    message=f"Question number {number} appears {count} times.",
                    question_number=number,
                )
            )

    return questions, warnings
