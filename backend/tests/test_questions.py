from app.parsers.questions import parse_questions


def numbers(questions):
    return [question.number for question in questions]


def test_q_prefixed_with_inline_options():
    questions, warnings = parse_questions(
        [
            "Q1. What is AI?",
            "A.  A learned system",
            "B.  A fixed rule",
            "Q2. What is ML?",
            "A.  One approach to AI",
            "B.  A spreadsheet",
        ]
    )
    assert numbers(questions) == [1, 2]
    assert questions[0].text == "What is AI?"
    assert questions[0].options == {"A": "A learned system", "B": "A fixed rule"}
    assert warnings == []


def test_bare_numbering_and_paren_markers():
    questions, _ = parse_questions(
        [
            "1) First question",
            "(A) alpha",
            "(B) beta",
            "2) Second question",
            "(A) gamma",
            "(B) delta",
        ]
    )
    assert numbers(questions) == [1, 2]
    assert questions[1].options == {"A": "gamma", "B": "delta"}


def test_question_word_prefix_and_lowercase_markers():
    questions, _ = parse_questions(
        ["Question 1: Pick one", "a. first", "b. second", "c. third"]
    )
    assert numbers(questions) == [1]
    assert sorted(questions[0].options) == ["A", "B", "C"]


def test_marker_alone_on_its_line_with_text_below():
    questions, _ = parse_questions(
        [
            "Q1. A scenario",
            "A.",
            "the first option",
            "continues here",
            "B.",
            "the second option",
        ]
    )
    assert questions[0].options == {
        "A": "the first option continues here",
        "B": "the second option",
    }


def test_wrapped_stem_and_wrapped_option_text():
    questions, _ = parse_questions(
        [
            "Q1. A long scenario that runs",
            "across three separate lines",
            "and ends with a question?",
            "A.  an option that also wraps",
            "onto a second line",
            "B.  a short one",
        ]
    )
    assert questions[0].text == (
        "A long scenario that runs across three separate lines and ends with a question?"
    )
    assert questions[0].options["A"] == "an option that also wraps onto a second line"


def test_stray_number_in_scenario_is_not_a_new_question():
    """The monotonic guard: a numbered line far out of sequence is body text."""
    questions, _ = parse_questions(
        [
            "1. The auditor reviewed the files.",
            "9. was the figure written in the margin",
            "A.  alpha",
            "B.  beta",
        ]
    )
    assert numbers(questions) == [1]
    assert "9. was the figure written in the margin" in questions[0].text


def test_initials_are_not_mistaken_for_an_option():
    """The sequential guard: 'B.P.' has no space after the dot, and B is not next."""
    questions, _ = parse_questions(
        ["Q1. On arrival", "B.P. was 140/90 on admission", "A.  alpha", "B.  beta"]
    )
    assert questions[0].options == {"A": "alpha", "B": "beta"}
    assert "B.P. was 140/90" in questions[0].text


def test_options_sharing_one_line_are_split():
    questions, _ = parse_questions(["Q1. Pick", "A. alpha   B. beta   C. gamma"])
    assert questions[0].options == {"A": "alpha", "B": "beta", "C": "gamma"}


def test_first_question_need_not_be_number_one():
    questions, _ = parse_questions(
        ["Q31. Starts mid-paper", "A.  alpha", "B.  beta", "Q32. Next", "A.  x", "B.  y"]
    )
    assert numbers(questions) == [31, 32]


def test_five_options_are_supported():
    questions, _ = parse_questions(
        ["Q1. Which option applies here?", "A.  a", "B.  b", "C.  c", "D.  d", "E.  e"]
    )
    assert sorted(questions[0].options) == list("ABCDE")
    assert questions[0].issues == []


def test_numbering_gap_is_reported_not_hidden():
    questions, warnings = parse_questions(
        ["Q1. First", "A.  a", "B.  b", "Q3. Third", "A.  x", "B.  y"]
    )
    assert numbers(questions) == [1, 3]
    assert [w.code for w in warnings] == ["question_number_gap"]


def test_too_few_options_is_flagged():
    questions, _ = parse_questions(["Q1. Lonely", "A.  only one"])
    assert "too_few_options" in questions[0].issues


def test_missing_leading_option_letter_is_flagged():
    questions, _ = parse_questions(["Q1. Pick", "B.  beta", "C.  gamma"])
    assert questions[0].options == {"B": "beta", "C": "gamma"}
    assert "missing_option_A" in questions[0].issues
    assert "non_contiguous_options" in questions[0].issues


def test_duplicate_question_numbers_are_reported():
    questions, warnings = parse_questions(
        ["Q1. First", "A.  a", "B.  b", "Q2. Second", "A.  x", "B.  y", "Q2. Again"]
    )
    # The repeated "Q2." is out of sequence, so it is read as continuation text.
    assert numbers(questions) == [1, 2]
    assert warnings == []


def test_preamble_before_the_first_question_is_ignored():
    questions, _ = parse_questions(
        ["Some Exam Title", "60 Questions", "Q1. Real question", "A.  a", "B.  b"]
    )
    assert numbers(questions) == [1]
    assert questions[0].text == "Real question"


def test_empty_input():
    questions, warnings = parse_questions([])
    assert questions == []
    assert warnings == []
