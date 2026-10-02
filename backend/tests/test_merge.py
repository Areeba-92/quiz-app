from app.parsers.answer_key import KeyEntry
from app.parsers.merge import apply_key
from app.schemas import Question


def question(number: int, letters: str = "ABCD") -> Question:
    return Question(
        number=number,
        text=f"Question {number}",
        options={letter: f"option {letter}" for letter in letters},
    )


def test_matches_by_number_not_by_position():
    """The whole point of the rule: order must not affect the result."""
    questions = [question(3), question(1), question(2)]
    key = {1: KeyEntry("A"), 2: KeyEntry("B"), 3: KeyEntry("C")}

    warnings = apply_key(questions, key)

    assert {q.number: q.correct for q in questions} == {1: "A", 2: "B", 3: "C"}
    assert warnings == []


def test_numbering_starting_at_thirty_one_still_matches():
    questions = [question(31), question(32)]
    key = {31: KeyEntry("D"), 32: KeyEntry("A")}

    apply_key(questions, key)

    assert [q.correct for q in questions] == ["D", "A"]


def test_explanation_from_the_key_is_carried_over():
    questions = [question(1)]
    apply_key(questions, {1: KeyEntry("B", "because it learns from data")})

    assert questions[0].correct == "B"
    assert questions[0].answer_source == "key"
    assert questions[0].explanation == "because it learns from data"
    assert questions[0].explanation_source == "key"


def test_letters_only_key_leaves_the_explanation_for_a_later_phase():
    questions = [question(1)]
    apply_key(questions, {1: KeyEntry("B")})

    assert questions[0].answer_source == "key"
    assert questions[0].explanation is None
    assert questions[0].explanation_source is None


def test_question_missing_from_the_key_is_left_unanswered():
    questions = [question(1), question(2)]
    warnings = apply_key(questions, {1: KeyEntry("A")})

    assert questions[1].correct is None
    assert questions[1].answer_source is None
    assert [w.code for w in warnings] == ["question_missing_key_entry"]
    assert warnings[0].question_number == 2


def test_many_missing_questions_collapse_into_one_warning():
    questions = [question(n) for n in range(1, 31)]
    warnings = apply_key(questions, {1: KeyEntry("A")})

    assert len(warnings) == 1
    assert warnings[0].code == "question_missing_key_entry"
    assert "29 of 30" in warnings[0].message


def test_key_entry_with_no_matching_question_is_reported():
    questions = [question(1)]
    warnings = apply_key(questions, {1: KeyEntry("A"), 61: KeyEntry("B")})

    assert [w.code for w in warnings] == ["key_entry_unmatched"]
    assert warnings[0].question_number == 61


def test_key_letter_outside_the_available_options_is_refused():
    questions = [question(1, letters="ABCD")]
    warnings = apply_key(questions, {1: KeyEntry("E")})

    assert questions[0].correct is None, "an impossible answer must not be accepted"
    assert "key_letter_not_an_option" in questions[0].issues
    assert [w.code for w in warnings] == ["key_letter_not_an_option"]


def test_empty_key_leaves_everything_unanswered():
    questions = [question(1), question(2)]
    warnings = apply_key(questions, {})

    assert all(q.correct is None for q in questions)
    assert len(warnings) == 2
