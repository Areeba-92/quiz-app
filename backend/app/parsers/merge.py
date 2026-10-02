"""Join parsed questions to a parsed answer key.

Matching is by question number and never by position: a key that skips an
entry, or a quiz whose first question is numbered 31, would silently corrupt
every answer under positional matching.
"""

from app.parsers.answer_key import KeyEntry
from app.schemas import ParseWarning, Question

# Above this many unanswered questions, report one summary instead of flooding
# the response with a warning per question.
MAX_INDIVIDUAL_WARNINGS = 10


def apply_key(questions: list[Question], key: dict[int, KeyEntry]) -> list[ParseWarning]:
    warnings: list[ParseWarning] = []
    numbers = {question.number for question in questions}
    missing: list[int] = []

    for question in questions:
        entry = key.get(question.number)
        if entry is None:
            missing.append(question.number)
            continue

        if question.options and entry.letter not in question.options:
            available = ", ".join(sorted(question.options)) or "none"
            warnings.append(
                ParseWarning(
                    code="key_letter_not_an_option",
                    message=(
                        f"The key answers question {question.number} with "
                        f"{entry.letter}, but its options are {available}. "
                        "It was left unanswered."
                    ),
                    question_number=question.number,
                )
            )
            question.issues.append("key_letter_not_an_option")
            continue

        question.correct = entry.letter
        question.answer_source = "key"
        if entry.explanation:
            question.explanation = entry.explanation
            question.explanation_source = "key"

    if missing:
        if len(missing) > MAX_INDIVIDUAL_WARNINGS:
            warnings.append(
                ParseWarning(
                    code="question_missing_key_entry",
                    message=(
                        f"{len(missing)} of {len(questions)} questions have no entry in "
                        f"the answer key and were left unanswered: "
                        f"{', '.join(str(n) for n in missing[:10])}, ..."
                    ),
                )
            )
        else:
            for number in missing:
                warnings.append(
                    ParseWarning(
                        code="question_missing_key_entry",
                        message=(
                            f"Question {number} has no entry in the answer key "
                            "and was left unanswered."
                        ),
                        question_number=number,
                    )
                )

    for number in sorted(set(key) - numbers):
        warnings.append(
            ParseWarning(
                code="key_entry_unmatched",
                message=(
                    f"The answer key has an entry for question {number}, "
                    "but no such question was found in the quiz."
                ),
                question_number=number,
            )
        )

    return warnings
