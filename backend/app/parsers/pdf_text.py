"""PDF bytes -> clean text lines, using PyMuPDF.

Only the text path lives here. Scanned pages are reported, never guessed at;
the vision path is phase 4.
"""

import re
from dataclasses import dataclass, field

import pymupdf

from app.schemas import ParseWarning

# Below this many non-whitespace characters a page is treated as having no
# usable text layer, i.e. scanned.
MIN_TEXT_CHARS = 20

# Fraction of pages a line must appear on, as a first or last line, to count
# as a running header or footer.
BOILERPLATE_RATIO = 0.6

_TRANSLATIONS = {
    "“": '"',
    "”": '"',
    "‘": "'",
    "’": "'",
    "–": "-",
    "—": "-",
    " ": " ",
    "…": "...",
    "ﬁ": "fi",
    "ﬂ": "fl",
}

_PAGE_NUMBER_RE = re.compile(r"^\s*(?:page\s*)?\d{1,4}\s*(?:(?:of|/)\s*\d{1,4})?\s*$", re.I)

# Used only to protect real content from boilerplate stripping.
_LOOKS_LIKE_QUESTION = re.compile(r"^\s*(?:Q(?:uestion)?\s*\.?\s*)?\d{1,3}\s*[.):\-]", re.I)
_LOOKS_LIKE_OPTION = re.compile(r"^\s*\(?[A-Ea-e]\)?\s*[.)]\s+\S")


class PdfError(Exception):
    """The file is not usable as a PDF."""


@dataclass
class ExtractedPdf:
    lines: list[str]
    page_count: int
    text_pages: int
    scanned_pages: list[int] = field(default_factory=list)
    title: str = ""
    warnings: list[ParseWarning] = field(default_factory=list)


def normalise(text: str) -> str:
    """Fold typographic characters down to plain ASCII equivalents."""
    for src, dst in _TRANSLATIONS.items():
        text = text.replace(src, dst)
    return text


def _open(data: bytes) -> pymupdf.Document:
    if not data:
        raise PdfError("The uploaded file is empty.")
    if not data.lstrip()[:5].startswith(b"%PDF-"):
        raise PdfError("The uploaded file is not a PDF.")
    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:  # pymupdf raises several types for bad input
        raise PdfError(f"The PDF could not be opened: {exc}") from exc
    if doc.needs_pass:
        doc.close()
        raise PdfError("The PDF is password protected.")
    return doc


def _find_boilerplate(pages: list[list[str]]) -> set[str]:
    """Running headers/footers: lines recurring at the top or bottom of pages."""
    if len(pages) < 2:
        return set()

    counts: dict[str, int] = {}
    for lines in pages:
        edges = {line for line in (lines[:1] + lines[-1:])}
        for line in edges:
            counts[line] = counts.get(line, 0) + 1

    threshold = max(2, int(len(pages) * BOILERPLATE_RATIO))
    return {
        line
        for line, count in counts.items()
        if count >= threshold
        and not _LOOKS_LIKE_QUESTION.match(line)
        and not _LOOKS_LIKE_OPTION.match(line)
    }


def _pick_title(first_page: list[str], boilerplate: set[str], fallback: str) -> str:
    for line in first_page:
        if line in boilerplate or len(line) > 120:
            continue
        if _LOOKS_LIKE_QUESTION.match(line) or _LOOKS_LIKE_OPTION.match(line):
            break
        return line
    return fallback


def extract(data: bytes, filename: str = "") -> ExtractedPdf:
    doc = _open(data)
    warnings: list[ParseWarning] = []
    scanned: list[int] = []
    pages: list[list[str]] = []

    try:
        for index in range(doc.page_count):
            raw = doc[index].get_text("text")
            page_no = index + 1
            if len(re.sub(r"\s", "", raw)) < MIN_TEXT_CHARS:
                scanned.append(page_no)
                warnings.append(
                    ParseWarning(
                        code="scanned_page",
                        message=(
                            f"Page {page_no} has no selectable text. It was skipped. "
                            "Scanned pages need the vision path, which is phase 4."
                        ),
                        page=page_no,
                    )
                )
                pages.append([])
                continue
            lines = [line.strip() for line in normalise(raw).splitlines()]
            pages.append([line for line in lines if line])
    finally:
        page_count = doc.page_count
        doc.close()

    boilerplate = _find_boilerplate(pages)
    body: list[str] = []
    for lines in pages:
        for line in lines:
            if line in boilerplate or _PAGE_NUMBER_RE.match(line):
                continue
            body.append(line)

    fallback = filename.rsplit("/", 1)[-1].removesuffix(".pdf") or "Untitled quiz"
    title = _pick_title(pages[0] if pages else [], boilerplate, fallback)

    return ExtractedPdf(
        lines=body,
        page_count=page_count,
        text_pages=page_count - len(scanned),
        scanned_pages=scanned,
        title=title,
        warnings=warnings,
    )
