"""POST /parse -- quiz PDF (+ optional answer key PDF) -> Question JSON."""

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import ai
from app.parsers import answer_key as answer_key_parser
from app.parsers import pdf_text
from app.parsers.merge import apply_key
from app.parsers.questions import parse_questions
from app.schemas import PageInfo, ParseResponse, ParseWarning

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

router = APIRouter()


async def _read(upload: UploadFile, label: str) -> bytes:
    data = await upload.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"The {label} PDF is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
        )
    return data


@router.post("/parse", response_model=ParseResponse)
async def parse(
    quiz: UploadFile = File(...),
    answer_key: UploadFile | None = File(None),
) -> ParseResponse:
    quiz_bytes = await _read(quiz, "quiz")
    # Scanned pages are read by OpenAI vision when it is set up, else skipped.
    transcribe = ai.transcribe_pages if ai.is_configured() else None

    try:
        # Off the event loop: reading scanned pages makes network calls.
        extracted = await run_in_threadpool(
            pdf_text.extract, quiz_bytes, quiz.filename or "", transcribe
        )
    except pdf_text.PdfError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    questions, warnings = parse_questions(extracted.lines)
    warnings = extracted.warnings + warnings

    if not questions:
        detail = "No questions could be read from this PDF."
        if extracted.scanned_pages and transcribe is None:
            detail += (
                " Its pages are scanned images. Add OPENAI_API_KEY and OPENAI_MODEL "
                "to backend/.env so they can be read."
            )
        raise HTTPException(status_code=422, detail=detail)

    if answer_key is not None:
        key_bytes = await _read(answer_key, "answer key")
        try:
            key_extracted = await run_in_threadpool(
                pdf_text.extract, key_bytes, answer_key.filename or "", transcribe
            )
        except pdf_text.PdfError as exc:
            raise HTTPException(status_code=400, detail=f"Answer key: {exc}") from exc
        entries, key_warnings = answer_key_parser.parse_answer_key(key_extracted.lines)
        warnings += key_extracted.warnings + key_warnings
        warnings += apply_key(questions, entries)
        if ai.is_configured():
            # Letters-only keys: OpenAI writes the missing reasons, never the answers.
            warnings += await run_in_threadpool(ai.explain_answers, questions)
    elif ai.is_configured():
        # The OpenAI client is synchronous; keep it off the event loop.
        warnings += await run_in_threadpool(ai.answer_questions, questions)
    else:
        warnings.append(
            ParseWarning(
                code="no_answer_key",
                message=(
                    "No answer key was supplied and OpenAI is not set up, so no question "
                    "has a correct answer. Add OPENAI_API_KEY and OPENAI_MODEL to backend/.env."
                ),
            )
        )

    return ParseResponse(
        title=extracted.title,
        question_count=len(questions),
        questions=questions,
        warnings=warnings,
        pages=PageInfo(
            total=extracted.page_count,
            text_pages=extracted.text_pages,
            scanned_pages=extracted.scanned_pages,
            vision_pages=extracted.vision_pages,
        ),
    )
