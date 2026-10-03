"""POST /check -- a second opinion from OpenAI on one question, during the quiz."""

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from app import ai
from app.schemas import CheckRequest, CheckResponse

router = APIRouter()


@router.post("/check", response_model=CheckResponse)
async def check(request: CheckRequest) -> CheckResponse:
    if not ai.is_configured():
        raise HTTPException(
            status_code=503,
            detail="OpenAI is not set up. Add OPENAI_API_KEY and OPENAI_MODEL to backend/.env.",
        )
    if len(request.question.options) < 2:
        raise HTTPException(status_code=422, detail="This question has too few options to check.")
    try:
        letter, reason = await run_in_threadpool(ai.check_answer, request.question)
    except ai.CheckFailed as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return CheckResponse(ai_answer=letter, ai_reason=reason)
