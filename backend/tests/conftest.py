from pathlib import Path

import pymupdf
import pytest

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "samples"
QUIZ_PDF = SAMPLES / "What_Actually_Is_AI_60_MCQs.pdf"
KEY_PDF = SAMPLES / "What_Actually_Is_AI_Answer_Key.pdf"


def make_pdf(pages: list[str], **save_kwargs) -> bytes:
    """Build a small PDF in memory, so tests need no fixture files on disk."""
    doc = pymupdf.open()
    for body in pages:
        page = doc.new_page()
        page.insert_textbox(pymupdf.Rect(40, 40, 560, 780), body, fontsize=9)
    data = doc.tobytes(**save_kwargs)
    doc.close()
    return data


@pytest.fixture
def pdf_builder():
    return make_pdf


needs_samples = pytest.mark.skipif(
    not (QUIZ_PDF.exists() and KEY_PDF.exists()),
    reason="sample PDFs are not present in data/samples/",
)


@pytest.fixture(autouse=True)
def no_real_openai(monkeypatch):
    """Tests must never spend money: hide any real key from backend/.env."""
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)


@pytest.fixture(autouse=True)
def temp_database(monkeypatch, tmp_path):
    """Tests write to a throwaway database, never data/app.db."""
    monkeypatch.setenv("QUIZ_DB_PATH", str(tmp_path / "test.db"))
