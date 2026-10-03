import { useEffect, useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { DoubleCheck } from '../components/DoubleCheck'
import { QuestionCard } from '../components/QuestionCard'
import { QuestionNavigator } from '../components/QuestionNavigator'
import type { Answers, CheckResult, Checks, Question } from '../types'

interface Props {
  title: string
  questions: Question[]
  answers: Answers
  flagged: Set<number>
  onAnswer: (number: number, letter: string) => void
  onToggleFlag: (number: number) => void
  onFinish: () => void
  busy?: boolean
  checks?: Checks
  onChecked?: (number: number, result: CheckResult) => void
}

export function QuizScreen({
  title,
  questions,
  answers,
  flagged,
  onAnswer,
  onToggleFlag,
  onFinish,
  busy = false,
  checks = {},
  onChecked = () => {},
}: Props) {
  const [index, setIndex] = useState(0)
  const [navigatorOpen, setNavigatorOpen] = useState(false)

  const question = questions[index]
  const isLast = index === questions.length - 1
  const isFlagged = flagged.has(question.number)
  const answeredCount = questions.filter((q) => answers[q.number] !== undefined).length

  const previous = () => setIndex((value) => Math.max(value - 1, 0))
  const next = () => setIndex((value) => Math.min(value + 1, questions.length - 1))

  // DESIGN.md: A-D select, arrows move, F flags.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.metaKey || event.ctrlKey || event.altKey) return

      const key = event.key.toUpperCase()
      if (Object.prototype.hasOwnProperty.call(question.options, key)) {
        // A double-checked answer is locked; the keys must respect that too.
        if (checks[question.number]) return
        event.preventDefault()
        onAnswer(question.number, key)
      } else if (event.key === 'ArrowRight') {
        next()
      } else if (event.key === 'ArrowLeft') {
        previous()
      } else if (key === 'F') {
        onToggleFlag(question.number)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [question, questions.length, onAnswer, onToggleFlag, checks])

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 pb-40 wide:pb-6">
      <header className="mb-4">
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">{title}</p>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p className="font-medium tabular-nums">
            {index + 1} / {questions.length}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{answeredCount} answered</p>
        </div>
        <ProgressBar value={index + 1} max={questions.length} />
      </header>

      <div className="flex gap-6">
        <main className="min-w-0 flex-1">
          <QuestionCard
            question={question}
            chosen={answers[question.number]}
            locked={checks[question.number] !== undefined}
            onSelect={(letter) => onAnswer(question.number, letter)}
          />
          {/* Only a key-backed answer has something to double check against. */}
          {question.answer_source === 'key' && question.correct && (
            <DoubleCheck
              key={question.number}
              question={question}
              chosen={answers[question.number]}
              result={checks[question.number]}
              onChecked={(result) => onChecked(question.number, result)}
            />
          )}
          {/* Likewise one control bar: pinned to the bottom on a phone, inline under the
              question on desktop, so a tall navigator never pushes it down. */}
          <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] wide:static wide:mt-4 wide:border-0 wide:bg-transparent wide:p-0 dark:border-slate-800 dark:bg-slate-900 wide:dark:bg-transparent">
            <div className="mx-auto flex max-w-5xl items-center gap-2 wide:max-w-none">
              {/*
                At 360px four labelled buttons leave Next too narrow to tap, so on
                a phone Previous and Flag show only their icon. aria-label keeps
                the full name for screen readers either way.
              */}
              <button
                type="button"
                onClick={previous}
                disabled={index === 0}
                aria-label="Previous"
                className="min-h-11 min-w-11 rounded-xl border border-slate-300 px-3 text-sm disabled:opacity-40 sm:px-4 dark:border-slate-700"
              >
                <span aria-hidden="true" className="text-lg leading-none">&lsaquo;</span>
                <span aria-hidden="true" className="hidden sm:inline"> Previous</span>
              </button>
              <button
                type="button"
                onClick={() => onToggleFlag(question.number)}
                aria-pressed={isFlagged}
                aria-label={isFlagged ? 'Flagged' : 'Flag'}
                className={[
                  'min-h-11 min-w-11 rounded-xl border px-3 text-sm sm:px-4',
                  isFlagged
                    ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'border-slate-300 dark:border-slate-700',
                ].join(' ')}
              >
                <span aria-hidden="true">&#9873;</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  {' '}
                  {isFlagged ? 'Flagged' : 'Flag'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setNavigatorOpen((open) => !open)}
                aria-expanded={navigatorOpen}
                className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-3 text-sm wide:hidden dark:border-slate-700"
              >
                Questions
              </button>
              <button
                type="button"
                onClick={isLast ? onFinish : next}
                disabled={busy}
                className="ml-auto min-h-11 flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white hover:bg-indigo-700 disabled:bg-slate-400 wide:max-w-40 wide:flex-none"
              >
                {busy ? 'Scoring...' : isLast ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </main>

        {/*
          One navigator in the DOM, not two: a sidebar above 900px, and a
          drawer below it. Rendering it twice and hiding one with CSS would
          duplicate every button for screen readers.
        */}
        <aside
          className={[
            'wide:block wide:static wide:max-h-none wide:w-56 wide:shrink-0 wide:overflow-visible wide:border-0 wide:bg-transparent wide:p-0 wide:dark:bg-transparent',
            'fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 max-h-[50vh] overflow-y-auto border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900',
            navigatorOpen ? 'block' : 'hidden',
          ].join(' ')}
        >
          <h2 className="mb-2 hidden text-sm font-semibold text-slate-500 wide:block dark:text-slate-400">
            Questions
          </h2>
          <QuestionNavigator
            questions={questions}
            answers={answers}
            flagged={flagged}
            current={index}
            onJump={(nextIndex) => {
              setIndex(nextIndex)
              setNavigatorOpen(false)
            }}
          />
        </aside>
      </div>

    </div>
  )
}
