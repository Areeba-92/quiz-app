"""Saved quizzes and attempts.

POST /quizzes                 save a quiz as it starts (after any review edits)
POST /quizzes/{id}/attempts   score an attempt against the saved copy, and store it
"""

from fastapi import APIRouter, HTTPException

from app import db
from app.schemas import AttemptCreate, AttemptResponse, QuizCreate, QuizSaved
from app.scoring import score_attempt

router = APIRouter()


@router.post("/quizzes", response_model=QuizSaved)
def create_quiz(request: QuizCreate) -> QuizSaved:
    if not request.questions:
        raise HTTPException(status_code=422, detail="There are no questions to save.")
    quiz_id, created_at = db.save_quiz(request.title, request.questions)
    return QuizSaved(id=quiz_id, created_at=created_at)


@router.post("/quizzes/{quiz_id}/attempts", response_model=AttemptResponse)
def create_attempt(quiz_id: int, request: AttemptCreate) -> AttemptResponse:
    questions = db.get_quiz_questions(quiz_id)
    if questions is None:
        raise HTTPException(status_code=404, detail=f"Quiz {quiz_id} was not found.")

    known = {q.number for q in questions}
    numbers = sorted(known) if request.numbers is None else sorted(set(request.numbers))
    if unknown := sorted(set(numbers) - known):
        raise HTTPException(
            status_code=422, detail=f"These questions are not in this quiz: {unknown}."
        )
    if outside := sorted(set(request.answers) - set(numbers)):
        raise HTTPException(
            status_code=422, detail=f"Answers refer to questions not in this attempt: {outside}."
        )

    # Scored against the saved copy, never against questions the browser sends.
    chosen = [q for q in questions if q.number in set(numbers)]
    score = score_attempt(chosen, request.answers)
    attempt_id = db.save_attempt(quiz_id, numbers, request.answers, score)
    return AttemptResponse(**score.model_dump(), attempt_id=attempt_id, quiz_id=quiz_id)
