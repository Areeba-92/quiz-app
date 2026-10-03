# Improvement ideas

Recommendations after all 8 phases (3 Oct 2026). Tick a box when done, and add notes under an item as you go.
Size: S = an hour or so, M = a session.

## 1. Fix first
- [ ] **Quizzes with no answers at all.** "Grade IX" (0/20) and "Verifying Your RAG Assistant" (0/8) were saved with no correct answer on any question, neither from a key nor from the AI. Put those PDFs (and keys, if any) in `data/samples/` to find out why: likely a key layout the parser does not read, or the AI step failing behind a warning.
- [ ] **"Ask OpenAI for the missing ones"** on the review screen (S). One tap fills only the questions that still have no answer, marked AI-guessed, so a quiz is never unmarkable.

## 2. Biggest study wins
- [ ] **Print / save wrong answers** (S). One clean page of wrong questions, correct answers and reasons, for copying into handwritten notes (SOUL.md: support that habit).
- [ ] **Double-check results on the results screen** (S). Mark questions where OpenAI disagreed with the key, e.g. "check this in your book", so a possible key mistake is not forgotten.
- [ ] **History screen** (M). Past quizzes and scores, reopen one without uploading again. The data is already in `data/app.db`.
- [ ] **"Weak questions" retry** (M). Retry questions wrong more than once across attempts, not only in the last one.

## 3. Comfort
- [ ] **Reopen on the last question after a refresh** (S). It currently goes back to question 1.
- [ ] **Theme switch on the quiz screen** (S). Switch to dark at night without leaving the quiz.
- [ ] **Upload progress** (M). "Reading page 4 of 14..." for scanned PDFs, so the wait does not feel stuck.
- [ ] **Keep review edits after a refresh** (S). They are lost if the page is refreshed before Start quiz.

## 4. Trust and safety
- [ ] **Check the whole key at once** (M). A "Check key with OpenAI" button on the review screen: OpenAI answers every question without seeing the key, and flags each disagreement before the quiz starts.
- [ ] **Cost display** (S). Show how many OpenAI calls an upload used.

## 5. Later
- [ ] **Use it on a phone away from the PC.** Needs a simple deployment; SOUL.md says to wait until the core works on the student's own machine, which it now does.
- [ ] **Tidy-up.** The stray root `.venv` and `{.claude,docs,backend,frontend,data` folders, and two old lint warnings (`QuizScreen.tsx` hook deps, `QuizScreen.test.tsx` unused expression).

## Recommended order
1. Fix the no-answer quizzes.
2. Print wrong answers.
3. Double-check results on the results screen.
