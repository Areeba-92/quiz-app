"""Quiz generation from a study PDF, in three steps the frontend drives.

1. POST /generate-quiz         PDF + settings -> text split into chunks (vision reads scanned pages)
2. POST /generate-quiz/chunk   one chunk -> its questions, called once per chunk
3. POST /generate-quiz/finish  all questions -> de-duplicated, numbered ParseResponse

Split up because Vercel caps each request at 300 s on Hobby and keeps no state
between requests, so one long call, or a job polled later, would not work there.
"""

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool

from app import ai, generate
from app.parsers import pdf_text
from app.routes.parse import _read
from app.schemas import (
    ChunkRequest,
    ChunkResponse,
    Difficulty,
    FinishRequest,
    GenerateChunk,
    GeneratePlan,
    PageInfo,
    ParseResponse,
    ParseWarning,
)

router = APIRouter()


def _require_ai() -> None:
    if not ai.is_configured():
        raise HTTPException(
            status_code=503,
            detail="Quiz generation needs OPENAI_API_KEY and OPENAI_MODEL in backend/.env.",
        )


def _plural(count: int, word: str) -> str:
    return f"{count} {word}{'' if count == 1 else 's'}"


@router.post("/generate-quiz", response_model=GeneratePlan)
async def plan(
    pdf: UploadFile = File(...),
    num_questions: int = Form(10, ge=1, le=generate.MAX_QUESTIONS),
    difficulty: Difficulty = Form("medium"),
    scenario_based: bool = Form(False),
) -> GeneratePlan:
    _require_ai()
    data = await _read(pdf, "study")
    try:
        extracted = await run_in_threadpool(
            pdf_text.extract, data, pdf.filename or "", ai.transcribe_pages
        )
    except pdf_text.PdfError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    chunks = generate.make_chunks(extracted.page_lines)
    if not chunks:
        raise HTTPException(status_code=422, detail="No readable text was found in this PDF.")

    counts = generate.allocate(chunks, num_questions)
    planned = sum(counts)
    warnings = list(extracted.warnings)
    if planned < num_questions:
        warnings.append(
            ParseWarning(
                code="generate_short_pdf",
                message=(
                    f"This PDF is short, so at most {_plural(planned, 'question')} "
                    f"will be written, not {num_questions}."
                ),
            )
        )

    return GeneratePlan(
        title=extracted.title,
        pages=PageInfo(
            total=extracted.page_count,
            text_pages=extracted.text_pages,
            scanned_pages=extracted.scanned_pages,
            vision_pages=extracted.vision_pages,
        ),
        chunks=[
            GenerateChunk(pages=chunk.pages, text=chunk.text, count=count)
            for chunk, count in zip(chunks, counts)
            if count > 0
        ],
        requested=num_questions,
        planned=planned,
        warnings=warnings,
    )


@router.post("/generate-quiz/chunk", response_model=ChunkResponse)
async def chunk(request: ChunkRequest) -> ChunkResponse:
    _require_ai()
    try:
        # The OpenAI client is synchronous; keep it off the event loop.
        items = await run_in_threadpool(
            ai.generate_questions,
            request.text,
            request.count,
            request.difficulty,
            request.scenario_based,
        )
    except ai.GenerateFailed as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    questions, skipped = generate.validate_items(items, request.pages)
    return ChunkResponse(questions=generate.shuffle_options(questions), skipped=skipped)


@router.post("/generate-quiz/finish", response_model=ParseResponse)
def finish(request: FinishRequest) -> ParseResponse:
    if not request.questions:
        raise HTTPException(status_code=422, detail="No questions could be generated from this PDF.")

    questions, removed = generate.dedupe(request.questions)
    questions = generate.renumber(questions)
    warnings = list(request.warnings)

    if request.skipped:
        warnings.append(
            ParseWarning(
                code="generate_skipped",
                message=f"{_plural(request.skipped, 'AI question')} broke the rules and were left out.",
            )
        )
    if removed:
        warnings.append(
            ParseWarning(
                code="generate_duplicates",
                message=f"{_plural(removed, 'near-duplicate question')} were removed.",
            )
        )
    if len(questions) < request.requested:
        warnings.append(
            ParseWarning(
                code="generate_fewer",
                message=f"You asked for {request.requested}; {len(questions)} are ready.",
            )
        )

    return ParseResponse(
        title=request.title,
        question_count=len(questions),
        questions=questions,
        warnings=warnings,
        pages=request.pages,
    )
