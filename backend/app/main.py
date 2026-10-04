"""FastAPI entry point. Run with: uvicorn app.main:app --reload"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.check import router as check_router
from app.routes.parse import router as parse_router
from app.routes.quizzes import router as quizzes_router
from app.routes.score import router as score_router

app = FastAPI(title="Quiz PDF App", version="0.1.0")

# The deployed frontend, plus the Vite dev server, which under WSL may be
# reached on either host. The middleware also answers OPTIONS preflights.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://quiz-app-c1oi.vercel.app",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router)
app.include_router(score_router)
app.include_router(quizzes_router)
app.include_router(check_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
