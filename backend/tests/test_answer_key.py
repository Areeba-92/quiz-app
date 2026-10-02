from app.parsers.answer_key import parse_answer_key


def test_quick_list_one_per_line():
    entries, warnings = parse_answer_key(["Quick Key", "Q1: A", "Q2: B", "Q3: D"])
    assert {n: e.letter for n, e in entries.items()} == {1: "A", 2: "B", 3: "D"}
    assert all(e.explanation is None for e in entries.values())
    assert warnings == []


def test_plain_numbering_without_q_prefix():
    entries, _ = parse_answer_key(["1. B", "2) C", "3 - A"])
    assert {n: e.letter for n, e in entries.items()} == {1: "B", 2: "C", 3: "A"}


def test_grid_layout_several_per_line():
    entries, _ = parse_answer_key(["1. B   2. A   3. D   4. C"])
    assert {n: e.letter for n, e in entries.items()} == {1: "B", 2: "A", 3: "D", 4: "C"}


def test_cell_per_line_table_with_reasons():
    entries, warnings = parse_answer_key(
        [
            "With Reasons",
            "Q",
            "Ans",
            "Reason",
            "Q1",
            "A",
            "Interprets an open-ended request rather than matching",
            "Q2",
            "B",
            "Infers a likely outcome from learned patterns",
        ]
    )
    assert entries[1].letter == "A"
    assert entries[1].explanation == "Interprets an open-ended request rather than matching"
    assert entries[2].letter == "B"
    assert warnings == []


def test_explanation_on_the_same_line():
    entries, _ = parse_answer_key(["1. B - because it learns from data rather than rules"])
    assert entries[1].letter == "B"
    assert entries[1].explanation == "because it learns from data rather than rules"


def test_short_trailing_fragment_is_not_an_explanation():
    entries, _ = parse_answer_key(["1. B .", "2. C -"])
    assert entries[1].explanation is None
    assert entries[2].explanation is None


def test_both_sections_agreeing_are_merged_with_the_explanation_kept():
    """The real sample's shape: a quick list, then the same answers with reasons."""
    entries, warnings = parse_answer_key(
        [
            "Quick Key",
            "Q1: A",
            "Q2: B",
            "With Reasons",
            "Q",
            "Ans",
            "Reason",
            "Q1",
            "A",
            "Interprets an open-ended request rather than matching",
            "Q2",
            "B",
            "Infers a likely outcome from learned patterns",
        ]
    )
    assert len(entries) == 2
    assert entries[1].letter == "A"
    assert entries[1].explanation == "Interprets an open-ended request rather than matching"
    assert warnings == []


def test_sections_disagreeing_leaves_the_answer_unset_and_warns():
    entries, warnings = parse_answer_key(
        [
            "Quick Key",
            "Q1: A",
            "Q2: B",
            "With Reasons",
            "Q1",
            "C",
            "This reason contradicts the quick key above",
            "Q2",
            "B",
            "This reason agrees with the quick key above",
        ]
    )
    assert 1 not in entries, "a conflicting answer must not be guessed at"
    assert entries[2].letter == "B"
    codes = [w.code for w in warnings]
    assert codes == ["key_self_conflict"]
    assert warnings[0].question_number == 1


def test_empty_key_is_reported():
    entries, warnings = parse_answer_key(["Answer Key", "nothing useful here"])
    assert entries == {}
    assert [w.code for w in warnings] == ["key_empty"]


def test_scattered_numbers_lower_confidence():
    entries, warnings = parse_answer_key(["3. A", "57. B", "901. C"])
    assert len(entries) == 3
    assert "key_low_confidence" in [w.code for w in warnings]


def test_dense_key_is_confident():
    entries, warnings = parse_answer_key([f"Q{n}: A" for n in range(1, 21)])
    assert len(entries) == 20
    assert warnings == []
