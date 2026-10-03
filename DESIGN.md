# DESIGN

UI and UX rules for the quiz app. Follow these when building any screen. Values and purpose are in @SOUL.md.

## Design goals
- Fast: from upload to first question with as few taps as possible.
- Calm: no clutter, no animation that slows answering.
- Honest: AI-guessed answers are always visibly marked.
- Mobile-first: usable on a phone as well as a laptop.

## Screen flow
Upload -> Review -> Quiz -> Results -> (Retry wrong only) -> Quiz
History is a later phase and lives behind a small link on the Upload screen.

## Screens

### 1. Upload
- Two drop zones: "Quiz PDF" (required) and "Answer key PDF" (optional).
- One primary button: "Build quiz". Disabled until a quiz PDF is chosen.
- States: idle, uploading, parsing (show progress by page), failed (plain message and a retry button).
- If scanned pages are detected, show a note: "Scanned pages take longer."

### 2. Review
- List of all extracted questions, collapsed to one line each. Tap to expand and edit text, options, correct answer.
- Questions with a likely extraction problem (missing option, empty text, no matched answer) get a warning icon and sort to the top.
- AI-guessed answers show an "AI-guessed" badge and can be overridden with one tap.
- Primary button: "Start quiz".

### 3. Quiz
- One question at a time.
- Top: progress ("12 / 60") and a thin progress bar.
- Scenario text in a scrollable card, then options A to D as large tappable buttons.
- Selecting an option highlights it. It does not reveal the answer. Answers are revealed on the Results screen.
- Bottom: Previous, Next, and a "Flag" toggle. On the last question, Next becomes "Finish".
- Question navigator: a grid of numbers, opened as a drawer on mobile and kept as a sidebar on desktop. Shows answered, unanswered, and flagged.
- "AI-guessed" badge shown on the question if the answer source is `ai`.
- "Double check" button under the options, on key-backed questions only, enabled once an answer is picked. It shows whether the answer matches the key and whether OpenAI (asked without seeing the key) agrees, with its reason. The answer then locks for that question.

### 4. Results
- Two scores at the top: "Key-backed: 38 / 50" and "All questions: 46 / 60". Hide the first when there are no AI-guessed questions.
- Filter tabs: All, Wrong, Flagged.
- Each wrong question shows: your answer, correct answer, short explanation, and the AI-guessed badge when relevant.
- Primary button: "Retry wrong only". Secondary: "New quiz".

## Visual style
- Light theme by default, dark theme follows the system setting.
- A Theme toggle (System / Light / Dark) at the top right of the Upload screen overrides the system setting. It starts on System and is remembered in the browser.
- System font stack. Base size 16px, comfortable line height for long scenario text.
- Spacing on a 4px scale. Rounded corners, subtle borders, little or no shadow.
- Color tokens:
  - Accent: indigo (primary buttons, selected option)
  - Correct: green
  - Wrong: red
  - AI-guessed: amber badge
  - Neutral: grays for surfaces and text
- Never use color alone. Pair it with an icon or label (check mark, cross, "AI-guessed").

## Responsive
- Design for 360px width first, then widen.
- Tap targets at least 44px high.
- Mobile: Previous and Next fixed at the bottom of the screen. Navigator opens as a drawer.
- Desktop (above 900px): question on the left, navigator sidebar on the right. Content width capped for readability.

## Keyboard and accessibility
- Keys A to D select an option. Left and right arrows move between questions. F toggles the flag.
- Visible focus outline on every interactive element.
- Text contrast meets WCAG AA.
- Options are real buttons or radio inputs, with labels readable by screen readers.

## Components to build
UploadDropzone, ProgressBar, QuestionCard, OptionButton, AiBadge, QuestionNavigator, ScoreSummary, ResultItem, ReviewRow, Toast.

## Don'ts
- No login screens, popups, or onboarding tours.
- No timers or countdowns unless asked for later.
- No revealing correct answers during the quiz, except when the student taps Double check (which locks that answer first).
- No hidden AI guesses. Every AI-chosen answer is badged.
