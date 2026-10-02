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
