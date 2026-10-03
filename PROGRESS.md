# PROGRESS

## Current phase
**All 8 phases are complete** and ticked in PLAN.md. 117 backend and 47 frontend tests pass, and the frontend builds clean.
Real runs on `gpt-6-luna` (3 Oct), all against the 60-question sample:
- No key: 8 s, 60/60 AI answers matched the real key.
- Image-only scans of quiz + key (16 pages): 39 s, every stem and option identical to the text path.
- Letters-only key: 6.6 s, answers untouched, 60/60 AI explanations.

## Decisions made
- AI provider is **OpenAI**. Key and `OPENAI_MODEL` live only in `backend/.env`. Never print the key in chat.
- All OpenAI calls are in `backend/app/ai.py`: 10 questions per call, parallel, enforced JSON schema, replies matched by question number.
- Errors are reported as type + HTTP status only. Raw OpenAI messages can echo the key.
- No key: AI answers every question (`answer_source = "ai"`). Gaps in a real key are never AI-filled.
- Letters-only key: AI writes the reason only (`explanation_source = "ai"`), labelled "Explanation written by AI".
- Scanned pages: rendered to PNG, transcribed by vision into lines, then the normal parsers run. `pages.vision_pages` lists them.
- Flow: Upload -> Review -> Quiz -> Results. Review is skipped only for a clean, fully key-backed parse.
- Review override sets `answer_source = "key"` (a person chose it) and clears the stale reason. So it counts as key-backed.
- Two scores always; the Key-backed tile is hidden when nothing is AI-guessed or its total is 0.
- Phase 7: quizzes are saved to `data/app.db` (stdlib sqlite3) when they start; attempts are scored against the saved copy via `POST /quizzes/{id}/attempts` and stored with the question numbers they covered.
- If saving fails the quiz still runs, scored by the stateless `POST /score`.
- The session in progress is kept in localStorage, so a refresh restores it. "New quiz" clears it.
- Retry wrong only: a new round of the wrong and unanswered questions, saved as its own attempt.
- Phase 8: checked with Playwright screenshots at 360px (light + dark) and 1280px: no sideways scroll, every tap target >= 44px. On phones Previous and Flag are icon-only (full aria-labels); bottom bars pad for the iPhone home indicator; edit fields are 16px so iOS does not zoom.
- Double check (`POST /check`): OpenAI answers one key-backed question blind; the panel shows match-with-key and OpenAI agree/disagree, then locks the answer so the score stays honest.
- Theme toggle (System / Light / Dark) on the Upload screen; `data-theme` on <html> drives Tailwind's `dark:` variant.
- Tests use a temp database and hide the OpenAI key, so they never touch real data or spend money.
- Areeba commits manually, once all phases are finished.

## Known issues
- The parser has only been tried on one family of PDFs. Vision was tested on clean rendered scans, not phone photos or handwriting.
- After a refresh the quiz reopens on question 1 (answers are kept).
- Edits made on the review screen are lost if the page is refreshed before Start quiz.
- No screen yet lists saved quizzes or attempts; they are only in the database.

## Next steps
- Improvement ideas, in recommended order, are in `docs/IDEAS.md`. Tick items there as they are done.
- First: find why "Grade IX" and "Verifying Your RAG Assistant" were saved with no answers (needs those PDFs in `data/samples/`).
- Areeba: review and commit when ready.
