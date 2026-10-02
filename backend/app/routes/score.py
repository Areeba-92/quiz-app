"""POST /score -- questions plus the student's answers -> two scores."""

from fastapi import APIRouter, HTTPException

from app.scoring import score_attempt
from app.schemas import ScoreRequest, ScoreResponse

router = APIRouter()


@router.post("/score", response_model=ScoreResponse)
def score(request: ScoreRequest) -> ScoreResponse:
    if not request.questions:
        raise HTTPException(status_code=422, detail="There are no questions to score.")

    numbers = {question.number for question in request.questions}
    unknown = sorted(set(request.answers) - numbers)
    if unknown:
        raise HTTPException(
            status_code=422,
            detail=f"Answers refer to questions that are not in this quiz: {unknown}.",
        )

    return score_attempt(request.questions, request.answers)
