# PROGRESS

## Current phase
Phases 1 and 2 are complete. 78 backend tests and 23 frontend tests pass, and the frontend builds clean.
Upload -> Quiz -> Results works end to end against the real 60-question sample.
Phase 3 is planned but **not started**. No AI code has been written.

## Decisions made
- 2 Oct: the AI provider changed from Claude to **OpenAI**. Nothing is built yet, and every doc still says Claude.
- Phase 3 shape: a single `backend/app/ai.py` calling OpenAI directly, 10 questions per call, replies constrained by an enforced JSON schema.
- The model ID is never hardcoded. It is read from `OPENAI_MODEL` in `backend/.env`.
- Scoring lives in `backend/app/scoring.py` behind a stateless `POST /score`.
- Two scores are always returned, key-backed and overall — an AI guess must never move the score the student relies on.
- The schema carries a top-level `warnings` list and a per-question `issues` field — a bad extraction is shown, never hidden. Also feeds the phase 5 review screen.
- Answer keys are read in full and cross-checked; a key that contradicts itself leaves the answer unset.
- The answer key is matched by question number, never by position.
- Frontend: Vite + React + TypeScript + Tailwind, tested with Vitest and React Testing Library. No router, no state library. It reaches the backend through a Vite dev proxy.
- Areeba commits manually, once all phases are finished.

## Known issues
- **CLAUDE.md, PLAN.md and .env.example all still name Claude.** They must be rewritten for OpenAI before phase 3 code is written, or the rules will contradict the code.
- The parser has only been tried on one family of PDFs (ReportLab-generated, `Q1.` numbering, clean text layer). Messy and scanned papers are untested.
- "Retry wrong only" is disabled on the Results screen; it belongs to phase 7.
- Refreshing the browser loses the quiz. No persistence until phase 7.
- A stray root `.venv` (mixed Windows and Linux layouts) and a stray `{.claude,docs,backend,frontend,data` folder both exist, unused, left in place.

## Next steps
Phase 3 is blocked on two things from Areeba:
1. An OpenAI API key, to go in `backend/.env`.
2. The exact `OPENAI_MODEL` string, taken from her account rather than guessed.

Three questions were asked but not answered, and should be settled first:
- Does the AI answer only when there is no key at all, or any question the key leaves unanswered?
- Automatic on upload, or ask first and show how many questions will be sent?
- Should each AI answer come back with a one-line reason in the same call?

Then: rewrite the docs for OpenAI, write `ai.py`, and test it against a mocked client so nothing costs money until the first real run.
