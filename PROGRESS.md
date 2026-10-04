# PROGRESS

## Current phase
**All 8 phases are complete** and ticked in PLAN.md. 117 backend and 47 frontend tests pass, and the frontend builds clean.
**Deployed on Vercel (4 Oct)** and working end to end: frontend https://quiz-app-c1oi.vercel.app, backend https://quiz-app-iota-two-80.vercel.app.
**Generate quiz from a study PDF (4 Oct)**: built and tested locally (157 backend, 53 frontend tests); real run on the sample, 8 questions, 4 chunks, 12 s. Tested on localhost, pushed to main the same day.
Real runs on `gpt-6-luna` (3 Oct), all against the 60-question sample:
- No key: 8 s, 60/60 AI answers matched the real key. Letters-only key: 6.6 s, answers untouched, 60/60 AI explanations.
- Image-only scans of quiz + key (16 pages): 39 s, every stem and option identical to the text path.

## Decisions made
- AI provider is **OpenAI**. Key and `OPENAI_MODEL` live only in `backend/.env`. Never print the key in chat.
- All OpenAI calls are in `backend/app/ai.py`: 10 questions per call, parallel, enforced JSON schema, replies matched by question number. Errors are reported as type + HTTP status only, since raw OpenAI messages can echo the key.
- No key: AI answers every question (`answer_source = "ai"`). Gaps in a real key are never AI-filled.
- Letters-only key: AI writes the reason only (`explanation_source = "ai"`), labelled "Explanation written by AI".
- Scanned pages: rendered to PNG, transcribed by vision into lines, then the normal parsers run. `pages.vision_pages` lists them.
- Flow: Upload -> Review -> Quiz -> Results. Review is skipped only for a clean, fully key-backed parse.
- Review override sets `answer_source = "key"` (a person chose it) and clears the stale reason. So it counts as key-backed.
- Two scores always; the Key-backed tile is hidden when nothing is AI-guessed or its total is 0.
- Phase 7: quizzes are saved to `data/app.db` (stdlib sqlite3) when they start; attempts are scored against the saved copy via `POST /quizzes/{id}/attempts` and stored with the question numbers they covered. If saving fails the quiz still runs, scored by the stateless `POST /score`.
- The session in progress is kept in localStorage, so a refresh restores it. "New quiz" clears it. Retry wrong only: a new round of the wrong and unanswered questions, saved as its own attempt.
- Phase 8: checked with Playwright screenshots at 360px (light + dark) and 1280px: no sideways scroll, every tap target >= 44px. On phones Previous and Flag are icon-only (full aria-labels); bottom bars pad for the iPhone home indicator; edit fields are 16px so iOS does not zoom.
- Double check (`POST /check`): OpenAI answers one key-backed question blind; the panel shows match-with-key and OpenAI agree/disagree, then locks the answer so the score stays honest.
- Theme toggle (System / Light / Dark) on the Upload screen; `data-theme` on <html> drives Tailwind's `dark:` variant.
- Tests use a temp database and hide the OpenAI key, so they never touch real data or spend money.
- Vercel: two projects from one repo (`frontend/`, `backend/`), redeploy on push to main. Frontend calls `VITE_API_URL` via `API_BASE` in `api.ts`; empty in dev, so the Vite proxy is used. Backend routes sit at the root, with no `/api` prefix.
- Generate: `POST /generate-quiz` (PDF -> chunks of <=4 pages, vision for scanned pages), `/generate-quiz/chunk` (one AI call, invalid JSON retried once, bad items skipped and counted), `/generate-quiz/finish` (stdlib difflib de-dup at 0.85, renumber). The frontend runs 3 chunks at a time. Chosen over job + polling because Vercel keeps no shared state between requests. Max 50 questions, 15 per chunk. Options are shuffled server-side so each letter is correct about equally often (the model favoured A/B).
- CORS allows the production frontend and localhost:5173 only. Vercel preview URLs are blocked.
- Areeba commits herself, or asks Claude to commit and push.

## Known issues
- The parser has only been tried on one family of PDFs. Vision was tested on clean rendered scans, not phone photos or handwriting.
- On Vercel, SQLite lives in `/tmp` and is wiped between instances, so stored quizzes and attempts are not kept. Scoring still works (falls back to `/score`). Keeping history needs a hosted database.
- Vercel limits: 4.5 MB request body (the app stops uploads over 4 MB in total) and 300 s per request on Hobby. Long scanned PDFs could get close to 300 s.
- After a refresh the quiz reopens on question 1. Review edits are lost if the page is refreshed before Start quiz.
- No screen yet lists saved quizzes or attempts; they are only in the database.

## Next steps
- Find why "Grade IX" and "Verifying Your RAG Assistant" were saved with no answers (needs those PDFs in `data/samples/`).
- Decide on a hosted database if quiz history should be kept online. More ideas, in order, are in `docs/IDEAS.md`.
