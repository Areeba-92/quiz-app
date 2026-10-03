import { useState } from 'react'
import { ResultItem } from '../components/ResultItem'
import { ScoreSummary } from '../components/ScoreSummary'
import type { Question, ScoreResponse } from '../types'

interface Props {
  title: string
  questions: Question[]
  result: ScoreResponse
  flagged: Set<number>
  onRetry: () => void
  onNewQuiz: () => void
}

type Tab = 'all' | 'wrong' | 'flagged'

export function ResultsScreen({ title, questions, result, flagged, onRetry, onNewQuiz }: Props) {
  const [tab, setTab] = useState<Tab>('wrong')

  const wrongByNumber = new Map(result.wrong.map((item) => [item.number, item]))
  const hasAiAnswers = questions.some((question) => question.answer_source === 'ai')

  const shown = questions.filter((question) => {
    if (tab === 'wrong') return wrongByNumber.has(question.number)
    if (tab === 'flagged') return flagged.has(question.number)
    return true
  })

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: questions.length },
    { id: 'wrong', label: 'Wrong', count: result.wrong.length },
    { id: 'flagged', label: 'Flagged', count: flagged.size },
  ]

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{title}</p>
      <h1 className="mb-4 text-2xl font-semibold">Results</h1>

      <ScoreSummary
        scoreKeyOnly={result.score_key_only}
        scoreAll={result.score_all}
        hasAiAnswers={hasAiAnswers}
      />

      {result.unscored.length > 0 && (
        <p className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/50 dark:bg-amber-500/10">
          {result.unscored.length} question{result.unscored.length === 1 ? '' : 's'} had no
          correct answer available and could not be marked.
        </p>
      )}

      <div role="tablist" aria-label="Filter results" className="mt-6 flex gap-2">
        {tabs.map(({ id, label, count }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={[
              'min-h-11 rounded-xl border px-4 text-sm font-medium',
              tab === id
                ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
                : 'border-slate-300 dark:border-slate-700',
            ].join(' ')}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      <ul className="mt-4 grid gap-3">
        {shown.length === 0 && (
          <li className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            Nothing here.
          </li>
        )}
        {shown.map((question) => {
          const wrong = wrongByNumber.get(question.number)
          if (wrong) {
            return (
              <ResultItem
                key={question.number}
                item={wrong}
                flagged={flagged.has(question.number)}
              />
            )
          }
          return (
            <li
              key={question.number}
              className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <span aria-hidden="true" className="text-green-700 dark:text-green-300">
                &#10003;
              </span>
              <span>
                <span className="font-medium">Question {question.number}</span>
                <span className="text-slate-500 dark:text-slate-400"> &mdash; correct</span>
              </span>
            </li>
          )
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          disabled={result.wrong.length === 0}
          className="min-h-11 rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
        >
          Retry wrong only{result.wrong.length > 0 && ` (${result.wrong.length})`}
        </button>
        <button
          type="button"
          onClick={onNewQuiz}
          className="min-h-11 rounded-xl border border-slate-300 px-4 font-medium dark:border-slate-700"
        >
          New quiz
        </button>
      </div>
    </main>
  )
}
