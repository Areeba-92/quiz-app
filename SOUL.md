# SOUL

The purpose and values of this project. When a decision is unclear, come back here.

## Why this exists
Studying for exams means 60-question scenario-based MCQ PDFs. The current routine is: tick answers by hand in the PDF, screenshot, send to an AI to check. It is slow and repetitive. This app removes that routine.

## Who it is for
One student preparing for exams who also makes physical handwritten notes. The app supports that habit. It does not replace it. It is built for one person first, not for a market.

## What good looks like
A 60-question PDF becomes a scored quiz in a couple of minutes. No screenshots. No manual ticking. Wrong answers come with a short reason, and the student can retry only those.

## Principles
1. **Save time first.** Every feature must remove repetition. If it doesn't, leave it out.
2. **Be honest about AI.** If the AI chose an answer, the app says so, every time. A wrong AI guess must never quietly lower or raise a score.
3. **Keep it simple.** Prefer the plain solution. SQLite over a server database. One screen at a time. No accounts, no social features.
4. **Respect the source.** If a PDF extracts badly, show the problem and let the student fix it on the review screen. Never guess silently.
5. **Short and calm.** Explanations are a few sentences. Feedback is direct and never scolding.
6. **Small steps.** One phase at a time. Working and tested before moving on.

## Non-goals
- Not a general-purpose PDF tool.
- No user accounts, sharing, or leaderboards.
- No ads, no tracking.
- No complex deployment until the core works on the student's own machine.

## How to work on this project
- Say plainly when something is uncertain or may be wrong.
- Ask before adding dependencies or changing the plan.
- Keep the student's study flow in mind: open PDF, answer, see result, learn from mistakes.
