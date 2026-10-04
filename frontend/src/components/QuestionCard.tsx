import type { Question } from '../types'
import { AiBadge } from './AiBadge'
import { OptionButton } from './OptionButton'
import { SourcePage } from './SourcePage'

interface Props {
  question: Question
  chosen: string | undefined
  locked?: boolean
  onSelect: (letter: string) => void
}

export function QuestionCard({ question, chosen, locked = false, onSelect }: Props) {
  const letters = Object.keys(question.options).sort()

  return (
    <section aria-labelledby={`question-${question.number}`}>
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-2 flex items-center gap-2">
          <h2
            id={`question-${question.number}`}
            className="text-sm font-semibold text-slate-500 dark:text-slate-400"
          >
            Question {question.number}
          </h2>
          {question.answer_source === 'ai' && <AiBadge />}
          <SourcePage page={question.source_page} />
        </div>
        <p className="max-h-72 overflow-y-auto whitespace-pre-line break-words text-slate-900 dark:text-slate-100">
          {question.text}
        </p>
      </div>

      <div role="radiogroup" aria-labelledby={`question-${question.number}`} className="grid gap-2">
        {letters.map((letter) => (
          <OptionButton
            key={letter}
            letter={letter}
            text={question.options[letter]}
            selected={chosen === letter}
            locked={locked}
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  )
}
