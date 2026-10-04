# Quiz PDF App

Web app that turns MCQ quiz PDFs (often scenario-based, ~60 questions) into a clickable quiz with instant scoring and explanations for wrong answers. Replaces the manual flow: tick in PDF, screenshot, send to Claude.
 
Only work inside this folder. Do not read or edit anything outside it.
Purpose and values: @SOUL.md UI and UX rules: @DESIGN.md Full plan and build phases: @docs/PLAN.md

## Stack
- Frontend: React + Vite + Tailwind (`frontend/`)
- Backend: Python FastAPI (`backend/`)
- PDF text: PyMuPDF. Scanned pages: OpenAI vision.
- AI: OpenAI API, called from the backend only. Model ID read from `OPENAI_MODEL` in `backend/.env`, never hardcoded.
- DB: SQLite at `data/app.db`

## Environment
- WSL2 (Linux). Project lives in the Linux filesystem (`~/quiz-app`), never under `/mnt/c`.
- Python venv at `backend/.venv`. Activate with `source backend/.venv/bin/activate`.
- Dev servers run in WSL and are opened from the Windows browser at `localhost`.
- Vite must run with `--host` if localhost does not forward.

## Commands
- Backend dev: `cd backend && source .venv/bin/activate && uvicorn app.main:app --reload`
- Backend tests: `cd backend && source .venv/bin/activate && pytest`
- Frontend dev: `cd frontend && npm run dev -- --host`
- Frontend build: `cd frontend && npm run build`

## Deployment
- Vercel, two projects from `Areeba-92/quiz-app` (branch `main`): root `frontend/` -> https://quiz-app-c1oi.vercel.app, root `backend/` -> https://quiz-app-iota-two-80.vercel.app. A push to main redeploys both.
- Frontend env: `VITE_API_URL` = backend URL. Every API call goes through `API_BASE` in `frontend/src/api.ts`. Never use bare relative fetch paths.
- Backend env: `OPENAI_API_KEY`, `OPENAI_MODEL`. Vercel auto-detects `app/main.py`; routes are at the root (no `/api`).
- New frontend origins must be added to CORS in `backend/app/main.py`.
- Vercel limits: 4.5 MB request body, 300 s per request (Hobby), only `/tmp` writable (not durable).

## Structure
- `backend/app/parsers/` PDF to question JSON (text path and vision path)
- `backend/app/scoring.py` scoring and answer-key matching
- `backend/app/ai.py` all OpenAI API calls
- `frontend/src/` upload, review, quiz, results screens
- `data/samples/` sample PDFs for tests

## Rules
- The OpenAI API key lives only in `backend/.env`. Never expose it to the frontend. Never commit `.env`.
- Every parser, text or vision, must return the same JSON schema (see docs/PLAN.md). Nothing downstream may depend on which parser ran.
- Every question has `answer_source` = `key` or `ai`. Show an "AI-guessed" badge on every `ai` question, in the quiz and in results.
- Score is shown twice: key-backed questions only, and all questions.
- Match answer key to questions by question number, never by position.
- Work on one phase at a time. Do not build later phases early.
- Before adding a dependency, say why and ask.
- Write a test for each parser and scoring function. Run tests before saying a task is done.
- If a PDF extraction looks wrong, say so. Do not silently guess.
- At the end of each session, update PROGRESS.md. Keep it under 40 lines. Do not log small changes.

## Style
- Keep replies short and direct. English.
- Make small commits with clear messages.
