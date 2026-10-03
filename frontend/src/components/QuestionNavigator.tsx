import type { Answers, Question } from '../types'

interface Props {
  questions: Question[]
  answers: Answers
  flagged: Set<number>
  current: number
  onJump: (index: number) => void
}

export function QuestionNavigator({ questions, answers, flagged, current, onJump }: Props) {
  return (
    <nav aria-label="Question navigator">
      <ul className="grid grid-cols-6 gap-1.5 wide:grid-cols-5">
        {questions.map((question, index) => {
          const answered = answers[question.number] !== undefined
          const isFlagged = flagged.has(question.number)
          const isCurrent = index === current

          const state = isCurrent
            ? 'current'
            : isFlagged
              ? 'flagged'
              : answered
                ? 'answered'
                : 'unanswered'

          return (
            <li key={question.number}>
              <button
                type="button"
                onClick={() => onJump(index)}
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={`Question ${question.number}, ${
                  isFlagged ? 'flagged, ' : ''
                }${answered ? 'answered' : 'not answered'}`}
                className={[
                  'relative flex h-11 w-full items-center justify-center rounded-lg border text-sm font-medium',
                  state === 'current'
                    ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
                    : state === 'flagged'
                      ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200'
                      : state === 'answered'
                        ? 'border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                        : 'border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400',
                ].join(' ')}
              >
                {question.number}
                {isFlagged && (
                  <span aria-hidden="true" className="absolute right-1 top-0.5 text-[10px]">
                    &#9873;
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
