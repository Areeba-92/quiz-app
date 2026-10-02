# First prompt for Claude Code (phase 1)

Start Claude Code in the project folder, switch to plan mode, then paste:

---
Read CLAUDE.md and docs/PLAN.md.

We are doing phase 1 only: text PDF to JSON, with the answer key matched by question number.

Do not write code yet. First give me a short plan covering:
1. The backend skeleton (FastAPI, folder layout under backend/app/)
2. The endpoint: POST /parse takes a quiz PDF and an optional answer-key PDF, returns the Question JSON from docs/PLAN.md
3. How you will detect and parse questions and options from extracted text
4. How you will match the key by question number
5. The tests you will write using PDFs in data/samples/

Ask me for anything you need, such as a sample PDF. Wait for my approval before coding.
---
