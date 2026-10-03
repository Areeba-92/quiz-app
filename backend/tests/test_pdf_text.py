import pymupdf
import pytest

from app.parsers import pdf_text
from tests.conftest import make_pdf


def test_extracts_lines_from_a_generated_pdf():
    data = make_pdf(["Q1. What is AI?\nA.  A learned system\nB.  A fixed rule"])
    result = pdf_text.extract(data, "quiz.pdf")

    assert result.page_count == 1
    assert result.text_pages == 1
    assert result.scanned_pages == []
    assert "Q1. What is AI?" in result.lines


def test_running_header_and_footer_are_stripped():
    pages = [
        f"Mock Exam 2026\nQ{n}. Question {n}\nA.  alpha\nB.  beta\nPage {n} of 3"
        for n in (1, 2, 3)
    ]
    result = pdf_text.extract(make_pdf(pages), "quiz.pdf")

    assert "Mock Exam 2026" not in result.lines
    assert not any(line.startswith("Page ") for line in result.lines)
    assert "Q2. Question 2" in result.lines


def test_a_repeated_line_that_is_really_a_question_is_kept():
    pages = ["Q1. Same wording\nA.  a\nB.  b", "Q1. Same wording\nA.  a\nB.  b"]
    result = pdf_text.extract(make_pdf(pages), "quiz.pdf")

    assert result.lines.count("Q1. Same wording") == 2


def test_blank_page_is_reported_as_scanned_not_skipped_silently():
    page = "Q1. A question with enough text to read\nA.  alpha\nB.  beta"
    result = pdf_text.extract(make_pdf([page, ""]), "quiz.pdf")

    assert result.scanned_pages == [2]
    assert result.text_pages == 1
    assert [w.code for w in result.warnings] == ["scanned_page"]
    assert result.warnings[0].page == 2
    assert "OPENAI_API_KEY" in result.warnings[0].message


PAGE_ONE = "Q1. A question with enough text to read\nA.  alpha\nB.  beta"


def test_scanned_pages_are_transcribed_and_kept_in_page_order():
    seen = []

    def transcribe(images):
        seen.extend(images)
        return [pdf_text.PageText(lines=["Q2. Read from the scan", "A. gamma", "B. delta"])]

    result = pdf_text.extract(make_pdf([PAGE_ONE, "", ]), "quiz.pdf", transcribe)

    assert len(seen) == 1 and seen[0].startswith(b"\x89PNG")
    assert result.vision_pages == [2]
    assert result.scanned_pages == [2]
    assert result.warnings == []
    assert result.lines.index("Q2. Read from the scan") > result.lines.index(
        "Q1. A question with enough text to read"
    )


def test_text_pages_are_never_sent_to_the_transcriber():
    def transcribe(images):
        raise AssertionError("should not be called")

    result = pdf_text.extract(make_pdf([PAGE_ONE]), "quiz.pdf", transcribe)
    assert result.vision_pages == []


def test_a_failed_transcription_is_reported_and_the_page_skipped():
    result = pdf_text.extract(
        make_pdf([PAGE_ONE, ""]), "quiz.pdf", lambda images: ["RateLimitError (HTTP 429)"]
    )

    assert result.vision_pages == []
    assert [w.code for w in result.warnings] == ["vision_failed"]
    assert result.warnings[0].page == 2
    assert "HTTP 429" in result.warnings[0].message


def test_an_unclear_scan_is_kept_but_flagged():
    result = pdf_text.extract(
        make_pdf([PAGE_ONE, ""]),
        "quiz.pdf",
        lambda images: [pdf_text.PageText(lines=["Q2. Smudged text"], unclear=True)],
    )

    assert "Q2. Smudged text" in result.lines
    assert [w.code for w in result.warnings] == ["vision_unclear"]


def test_transcribed_text_is_normalised_like_the_text_path():
    result = pdf_text.extract(
        make_pdf([PAGE_ONE, ""]),
        "quiz.pdf",
        lambda images: [pdf_text.PageText(lines=["  Q2. \u201cQuoted\u201d  ", "", "A. x"])],
    )

    assert 'Q2. "Quoted"' in result.lines
    assert "" not in result.lines


def test_title_comes_from_the_first_page():
    result = pdf_text.extract(
        make_pdf(["What Actually Is AI?\nQ1. First\nA.  a\nB.  b"]), "quiz.pdf"
    )
    assert result.title == "What Actually Is AI?"


def test_title_falls_back_to_the_filename():
    result = pdf_text.extract(make_pdf(["Q1. First\nA.  a\nB.  b"]), "my-quiz.pdf")
    assert result.title == "my-quiz"


def test_typographic_characters_are_normalised():
    # Tested directly: the base-14 fonts used to build test PDFs cannot encode
    # these characters, though the real sample PDFs contain them.
    assert pdf_text.normalise("A “quoted” term – here") == 'A "quoted" term - here'
    assert pdf_text.normalise("it’s … fine now") == "it's ... fine now"


def test_a_non_pdf_is_refused():
    with pytest.raises(pdf_text.PdfError, match="not a PDF"):
        pdf_text.extract(b"this is plainly not a pdf", "notes.txt")


def test_an_empty_upload_is_refused():
    with pytest.raises(pdf_text.PdfError, match="empty"):
        pdf_text.extract(b"", "empty.pdf")


def test_a_truncated_pdf_is_refused():
    data = make_pdf(["Q1. First\nA.  a\nB.  b"])
    with pytest.raises(pdf_text.PdfError):
        pdf_text.extract(data[: len(data) // 3], "broken.pdf")


def test_a_password_protected_pdf_is_refused():
    data = make_pdf(
        ["Q1. First\nA.  a\nB.  b"],
        encryption=pymupdf.PDF_ENCRYPT_AES_256,
        owner_pw="owner",
        user_pw="user",
    )
    with pytest.raises(pdf_text.PdfError, match="password"):
        pdf_text.extract(data, "locked.pdf")
