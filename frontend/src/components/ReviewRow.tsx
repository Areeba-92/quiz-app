import type { Question } from '../types'
import { AiBadge } from './AiBadge'
import { SourcePage } from './SourcePage'

interface Props {
  question: Question
  problems: string[]
  expanded: boolean
  onToggle: () => void
  onChange: (question: Question) => void
}

const BASE_LETTERS = ['A', 'B', 'C', 'D']

/** Letters to offer inputs for: A to D always, plus any extra the PDF had. */
function optionLetters(question: Question): string[] {
  return [...new Set([...BASE_LETTERS, ...Object.keys(question.options)])].sort()
}

export function ReviewRow({ question, problems, expanded, onToggle, onChange }: Props) {
  const letters = optionLetters(question)
  const isAi = question.answer_source === 'ai'
  const panelId = `review-${question.number}`

  function setCorrect(letter: string) {
    if (letter === question.correct) {
      // Tapping the AI's own letter confirms it: a person has now checked it.
      if (isAi) onChange({ ...question, answer_source: 'key' })
      return
    }
    // A different letter: the student overrides. The old reason argued for
    // another answer, so it no longer applies.
    onChange({
      ...question,
      correct: letter,
      answer_source: 'key',
      explanation: null,
      explanation_source: null,
    })
  }

  function setOption(letter: string, text: string) {
    onChange({ ...question, options: { ...question.options, [letter]: text } })
  }

  return (
    <li className="min-w-0 rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center gap-2 p-3 text-left"
      >
        {problems.length > 0 ? (
          <span className="shrink-0 text-amber-600 dark:text-amber-400" title={problems.join('. ')}>
            <span aria-hidden="true">&#9888;</span>
            <span className="sr-only">Needs a look: {problems.join('. ')}.</span>
          </span>
        ) : (
          <span aria-hidden="true" className="w-4 shrink-0" />
        )}
        <span className="shrink-0 text-sm font-semibold text-slate-500 dark:text-slate-400">
          Q{question.number}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm">
          {question.text || <em className="text-slate-400">No question text</em>}
        </span>
        {isAi && <AiBadge />}
        {/* No room on a phone; the open panel shows the page there. */}
        <SourcePage page={question.source_page} className="hidden sm:inline-block" />
        <span className="shrink-0 rounded-lg border border-slate-300 px-2 text-sm font-medium tabular-nums dark:border-slate-700">
          {question.correct ?? '–'}
          <span className="sr-only">{question.correct ? ' is correct' : ' no answer set'}</span>
        </span>
      </button>

      {expanded && (
        <div id={panelId} className="grid gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
          {problems.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-amber-800 dark:text-amber-200">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          {question.source_page && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Written from page {question.source_page} of the study PDF.
            </p>
          )}

          <label className="grid gap-1 text-sm font-medium">
            Question text
            <textarea
              value={question.text}
              onChange={(event) => onChange({ ...question, text: event.target.value })}
              rows={4}
              className="rounded-xl border border-slate-300 bg-transparent p-2 text-base font-normal dark:border-slate-700"
            />
          </label>

          {letters.map((letter) => (
            <label key={letter} className="grid gap-1 text-sm font-medium">
              Option {letter}
              <input
                type="text"
                value={question.options[letter] ?? ''}
                onChange={(event) => setOption(letter, event.target.value)}
                className="min-h-11 rounded-xl border border-slate-300 bg-transparent px-2 text-base font-normal dark:border-slate-700"
              />
            </label>
          ))}

          <div>
            <p id={`${panelId}-correct`} className="mb-1 text-sm font-medium">
              Correct answer
              {isAi && (
                <span className="font-normal text-slate-500 dark:text-slate-400">
                  {' '}
                  &mdash; picked by AI. Tap it to confirm, or pick another.
                </span>
              )}
            </p>
            <div role="radiogroup" aria-labelledby={`${panelId}-correct`} className="flex flex-wrap gap-2">
              {letters.map((letter) => {
                const selected = question.correct === letter
                return (
                  <button
                    key={letter}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Correct answer ${letter}`}
                    onClick={() => setCorrect(letter)}
                    className={[
                      'min-h-11 min-w-11 rounded-xl border px-3 text-sm font-semibold',
                      selected
                        ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
                        : 'border-slate-300 dark:border-slate-700',
                    ].join(' ')}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </li>
  )
}
