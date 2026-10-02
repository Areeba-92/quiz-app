"""Answer-key text -> {question number: KeyEntry}.

A key often states the same answer more than once, for example a quick list
followed by a table with reasons. Both are read and cross-checked: if they
disagree the answer is left unset and a warning is raised, because silently
picking one of two conflicting answers is exactly the kind of guess the
project rules forbid.
"""

import re
from dataclasses import dataclass

from app.schemas import ParseWarning

# "Q1: A", "1. B", "1 - C", optionally followed by a reason on the same line.
LINE_ENTRY = re.compile(
    r"^Q?\s*(\d{1,3})(?!\d)\s*[:.)\-]\s*\(?([A-Ea-e])\)?(?![A-Za-z])\s*[-:.]?\s*(.*)$",
    re.I,
)
# Several answers sharing one line: "1. B   2. A   3. D"
PAIR = re.compile(r"(?<![A-Za-z0-9])Q?\s*(\d{1,3})(?!\d)\s*[:.)\-]\s*\(?([A-Ea-e])\)?(?![A-Za-z])")
# A table that puts each cell on its own line: "Q1" / "A" / "reason"
TABLE_NUMBER = re.compile(r"^Q\s*(\d{1,3})(?!\d)\s*$", re.I)
TABLE_LETTER = re.compile(r"^\(?([A-Ea-e])\)?[.)]?\s*$")

# Shorter than this and a trailing fragment is punctuation, not a reason.
MIN_EXPLANATION_CHARS = 15


@dataclass
class KeyEntry:
    letter: str
    explanation: str | None = None


@dataclass
class _Candidate:
    number: int
    letter: str
    explanation: str | None
    source: str


def _clean_explanation(text: str) -> str | None:
    text = text.strip(" -:.\t")
    return text if len(text) >= MIN_EXPLANATION_CHARS else None


def _parse_table(lines: list[str]) -> tuple[list[_Candidate], set[int]]:
    """Cell-per-line tables. Header rows are skipped naturally: "Q" has no digits."""
    found: list[_Candidate] = []
    consumed: set[int] = set()

    for index in range(len(lines) - 2):
        number_match = TABLE_NUMBER.match(lines[index])
        letter_match = TABLE_LETTER.match(lines[index + 1])
        if not (number_match and letter_match):
            continue
        reason = lines[index + 2]
        # A following cell that is itself a number or letter means this table
        # has no reason column.
        if TABLE_NUMBER.match(reason) or TABLE_LETTER.match(reason):
            reason = ""
        else:
            consumed.add(index + 2)
        consumed.update({index, index + 1})
        found.append(
            _Candidate(
                number=int(number_match.group(1)),
                letter=letter_match.group(1).upper(),
                explanation=_clean_explanation(reason),
                source="table",
            )
        )
    return found, consumed


def _parse_lines(lines: list[str], skip: set[int]) -> list[_Candidate]:
    found: list[_Candidate] = []
    for index, line in enumerate(lines):
        if index in skip or not line.strip():
            continue

        pairs = list(PAIR.finditer(line))
        if len(pairs) >= 2:  # grid layout, letters only
            for match in pairs:
                found.append(
                    _Candidate(
                        number=int(match.group(1)),
                        letter=match.group(2).upper(),
                        explanation=None,
                        source="grid",
                    )
                )
            continue

        match = LINE_ENTRY.match(line)
        if match:
            found.append(
                _Candidate(
                    number=int(match.group(1)),
                    letter=match.group(2).upper(),
                    explanation=_clean_explanation(match.group(3)),
                    source="line",
                )
            )
    return found


def parse_answer_key(lines: list[str]) -> tuple[dict[int, KeyEntry], list[ParseWarning]]:
    warnings: list[ParseWarning] = []

    table, consumed = _parse_table(lines)
    candidates = table + _parse_lines(lines, consumed)

    grouped: dict[int, list[_Candidate]] = {}
    for candidate in candidates:
        grouped.setdefault(candidate.number, []).append(candidate)

    entries: dict[int, KeyEntry] = {}
    for number, group in sorted(grouped.items()):
        letters = {candidate.letter for candidate in group}
        if len(letters) > 1:
            warnings.append(
                ParseWarning(
                    code="key_self_conflict",
                    message=(
                        f"The key gives conflicting answers for question {number}: "
                        f"{', '.join(sorted(letters))}. It was left unanswered."
                    ),
                    question_number=number,
                )
            )
            continue
        explanation = next(
            (candidate.explanation for candidate in group if candidate.explanation), None
        )
        entries[number] = KeyEntry(letter=letters.pop(), explanation=explanation)

    if not entries:
        warnings.append(
            ParseWarning(
                code="key_empty",
                message="No answers could be read from the answer key.",
            )
        )
    else:
        span = max(entries) - min(entries) + 1
        if span > 2 * len(entries):
            warnings.append(
                ParseWarning(
                    code="key_low_confidence",
                    message=(
                        f"Only {len(entries)} answers were found across a range of {span} "
                        "question numbers. The key may have been misread."
                    ),
                )
            )

    return entries, warnings
