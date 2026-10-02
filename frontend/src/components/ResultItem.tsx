import type { WrongAnswer } from '../types'
import { AiBadge } from './AiBadge'

interface Props {
  item: WrongAnswer
  flagged: boolean
}

export function ResultItem({ item, flagged }: Props) {
  const yours = item.your_answer

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Question {item.number}
        </span>
        {item.answer_source === 'ai' && <AiBadge />}
        {flagged && (
          <span className="rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400">
            &#9873; Flagged
          </span>
        )}
      </div>

      <p className="mb-3 whitespace-pre-line text-slate-900 dark:text-slate-100">{item.text}</p>

      <div className="grid gap-2 text-sm">
        <p className="flex items-start gap-2 text-red-700 dark:text-red-300">
          <span aria-hidden="true">&#10007;</span>
          <span>
            <span className="font-medium">Your answer: </span>
            {yours ? `${yours}. ${item.options[yours] ?? ''}` : 'Not answered'}
          </span>
        </p>
        <p className="flex items-start gap-2 text-green-700 dark:text-green-300">
          <span aria-hidden="true">&#10003;</span>
          <span>
            <span className="font-medium">Correct answer: </span>
            {item.correct}. {item.options[item.correct] ?? ''}
          </span>
        </p>
      </div>

      {item.explanation && (
        <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {item.explanation}
        </p>
      )}
    </li>
  )
}
