"""Shared JSON schema. Every parser, text or vision, must return this."""

from typing import Literal

from pydantic import BaseModel, Field

Source = Literal["key", "ai"]


class Question(BaseModel):
    number: int
    text: str
    options: dict[str, str] = Field(default_factory=dict)
    correct: str | None = None
    answer_source: Source | None = None
    explanation: str | None = None
    explanation_source: Source | None = None
    # Extraction problems for this question. Feeds the review screen in phase 5.
    issues: list[str] = Field(default_factory=list)
    # Written by the AI from a study PDF, not read from a quiz PDF.
    generated: bool = False
    # The study PDF page a generated question was written from.
    source_page: int | None = None


class ParseWarning(BaseModel):
    """Named ParseWarning, not Warning, to avoid shadowing the builtin."""

    code: str
    message: str
    page: int | None = None
    question_number: int | None = None


class PageInfo(BaseModel):
    total: int
    text_pages: int
    scanned_pages: list[int] = Field(default_factory=list)
    # Scanned pages that were read by OpenAI vision. Text from these may hold misreads.
    vision_pages: list[int] = Field(default_factory=list)


class ParseResponse(BaseModel):
    title: str
    question_count: int
    questions: list[Question]
    warnings: list[ParseWarning] = Field(default_factory=list)
    pages: PageInfo


class Score(BaseModel):
    correct: int
    total: int


class WrongAnswer(BaseModel):
    number: int
    text: str
    your_answer: str | None
    correct: str
    options: dict[str, str] = Field(default_factory=dict)
    explanation: str | None = None
    explanation_source: Source | None = None
    answer_source: Source | None = None
    source_page: int | None = None


class ScoreRequest(BaseModel):
    questions: list[Question]
    # Question number -> chosen letter. Numbers are used as the key everywhere,
    # never list position.
    answers: dict[int, str] = Field(default_factory=dict)


class ScoreResponse(BaseModel):
    # Questions whose answer came from the key. Shown separately so an AI guess
    # can never quietly move a score the student is relying on.
    score_key_only: Score
    score_all: Score
    answered: int
    wrong: list[WrongAnswer] = Field(default_factory=list)
    # Questions with no correct answer available at all, so they cannot be marked.
    unscored: list[int] = Field(default_factory=list)


class QuizCreate(BaseModel):
    title: str
    questions: list[Question]


class QuizSaved(BaseModel):
    id: int
    created_at: str


class AttemptCreate(BaseModel):
    # Question number -> chosen letter, as in ScoreRequest.
    answers: dict[int, str] = Field(default_factory=dict)
    # The questions in this attempt. None means the whole quiz; a retry sends
    # only the numbers it covers.
    numbers: list[int] | None = None


class AttemptResponse(ScoreResponse):
    attempt_id: int
    quiz_id: int


class CheckRequest(BaseModel):
    question: Question


class CheckResponse(BaseModel):
    # OpenAI's own pick, made without seeing the key's answer.
    ai_answer: str
    ai_reason: str


Difficulty = Literal["easy", "medium", "hard"]


class GenerateChunk(BaseModel):
    """A few pages of a study PDF, and how many questions to write from them."""

    pages: list[int]
    text: str
    count: int


class GeneratePlan(BaseModel):
    title: str
    pages: PageInfo
    chunks: list[GenerateChunk]
    # What was asked for, and what the plan can carry (less for a short PDF).
    requested: int
    planned: int
    warnings: list[ParseWarning] = Field(default_factory=list)


class ChunkRequest(BaseModel):
    pages: list[int] = Field(min_length=1)
    text: str = Field(min_length=1, max_length=100_000)
    count: int = Field(ge=1, le=15)
    difficulty: Difficulty = "medium"
    scenario_based: bool = False


class ChunkResponse(BaseModel):
    questions: list[Question]
    # Items the AI returned that broke a rule and were dropped.
    skipped: int


class FinishRequest(BaseModel):
    title: str
    pages: PageInfo
    questions: list[Question]
    requested: int
    skipped: int = 0
    warnings: list[ParseWarning] = Field(default_factory=list)
