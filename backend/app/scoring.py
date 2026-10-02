"""Marking an attempt.

Two scores are always produced. The key-backed score covers only questions
whose answer came from a real answer key; the overall score adds questions
answered by Claude. Keeping them apart is the point: a wrong AI guess must
never quietly move the score the student is relying on.
"""

from app.schemas import Question, Score, ScoreResponse, WrongAnswer


def normalise_answer(value: str | None) -> str | None:
    """Accept "a", "A", "(A)" and "A." as the same choice."""
    if value is None:
        return None
    cleaned = value.strip().strip("().").upper()
    return cleaned or None


def score_attempt(questions: list[Question], answers: dict[int, str]) -> ScoreResponse:
    chosen = {number: normalise_answer(letter) for number, letter in answers.items()}

    key_correct = key_total = 0
    all_correct = all_total = 0
    answered = 0
    wrong: list[WrongAnswer] = []
    unscored: list[int] = []

    for question in questions:
        given = chosen.get(question.number)
        if given is not None:
            answered += 1

        if question.correct is None:
            # No key entry and no AI answer: it cannot be marked either way.
            unscored.append(question.number)
            continue

        is_right = given == question.correct
        all_total += 1
        if is_right:
            all_correct += 1

        if question.answer_source == "key":
            key_total += 1
            if is_right:
                key_correct += 1

        if not is_right:
            wrong.append(
                WrongAnswer(
                    number=question.number,
                    text=question.text,
                    your_answer=given,
                    correct=question.correct,
                    options=question.options,
                    explanation=question.explanation,
                    explanation_source=question.explanation_source,
                    answer_source=question.answer_source,
                )
            )

    return ScoreResponse(
        score_key_only=Score(correct=key_correct, total=key_total),
        score_all=Score(correct=all_correct, total=all_total),
        answered=answered,
        wrong=wrong,
        unscored=unscored,
    )
