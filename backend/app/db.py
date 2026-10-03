"""SQLite storage for quizzes and attempts, at data/app.db.

Plain sqlite3 from the standard library. Questions, answers and scores are
stored as JSON: they are only ever read back whole, never queried inside.
"""

import json
import os
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from app.schemas import Question, ScoreResponse

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "data" / "app.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    questions TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY,
    quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
    created_at TEXT NOT NULL,
    -- The question numbers this attempt covered: all of them, or a retry subset.
    numbers TEXT NOT NULL,
    answers TEXT NOT NULL,
    score_key_only TEXT NOT NULL,
    score_all TEXT NOT NULL,
    wrong TEXT NOT NULL
);
"""


def _path() -> Path:
    # Overridable so tests never touch the real database.
    return Path(os.environ.get("QUIZ_DB_PATH", DEFAULT_PATH))


def _connect() -> sqlite3.Connection:
    path = _path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.executescript(SCHEMA)
    return conn


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def save_quiz(title: str, questions: list[Question]) -> tuple[int, str]:
    created_at = _now()
    payload = json.dumps([q.model_dump() for q in questions])
    with closing(_connect()) as conn, conn:
        cursor = conn.execute(
            "INSERT INTO quizzes (title, created_at, questions) VALUES (?, ?, ?)",
            (title, created_at, payload),
        )
        return cursor.lastrowid, created_at


def get_quiz_questions(quiz_id: int) -> list[Question] | None:
    with closing(_connect()) as conn, conn:
        row = conn.execute("SELECT questions FROM quizzes WHERE id = ?", (quiz_id,)).fetchone()
    if row is None:
        return None
    return [Question.model_validate(item) for item in json.loads(row[0])]


def save_attempt(
    quiz_id: int, numbers: list[int], answers: dict[int, str], score: ScoreResponse
) -> int:
    with closing(_connect()) as conn, conn:
        cursor = conn.execute(
            "INSERT INTO attempts (quiz_id, created_at, numbers, answers, score_key_only,"
            " score_all, wrong) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                quiz_id,
                _now(),
                json.dumps(numbers),
                json.dumps(answers),
                score.score_key_only.model_dump_json(),
                score.score_all.model_dump_json(),
                json.dumps([w.model_dump() for w in score.wrong]),
            ),
        )
        return cursor.lastrowid
