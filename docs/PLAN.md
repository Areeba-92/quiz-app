# Plan

## Concept
Upload quiz PDF (+ optional answer key PDF) -> review extracted questions -> take quiz in browser -> instant score -> short reason for each wrong answer -> retry only wrong ones.

## Answer source modes
| PDF has | Correct answer from | Explanation from |
|---|---|---|
| Key with explanations | Key | Key |
| Key with letters only | Key | Claude |
| No key | Claude (marked AI-guessed) | Claude |

## Parsing
1. Per page: check for selectable text.
2. Text page: PyMuPDF extracts text, then parse into questions.
3. Scanned page: render to image, send to Claude vision, get JSON.
4. Both paths output the same schema.

## Data model
Question:
```json
{
  "number": 1,
  "text": "...",
  "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
  "correct": "B",
  "answer_source": "key",
  "explanation": "...",
  "explanation_source": "key"
}
```
Quiz: id, title, created_at, questions[]
Attempt: id, quiz_id, answers{number: letter}, score_key_only, score_all, wrong[]

## Build phases
- [ ] 1. Text PDF to JSON, answer key matched by question number
- [ ] 2. Quiz page and scoring
- [ ] 3. No-key mode (Claude picks answers, AI-guessed badge)
- [ ] 4. Scanned PDF path with Claude vision
- [ ] 5. Review screen with answer override
- [ ] 6. Explanations when the key has none
- [ ] 7. Saved attempts, retry wrong only
- [ ] 8. Phone layout

## Known risks
- Scenario-based questions may extract with broken formatting. Review screen exists for this.
- Scanned PDFs cost more API credit than text PDFs.
- AI-picked answers can be wrong. Always badge them.
