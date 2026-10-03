import { useState } from 'react'
import { ReviewRow } from '../components/ReviewRow'
import type { ParseResponse, Question } from '../types'

interface Props {
  quiz: ParseResponse
  onStart: (questions: Question[]) => void
}

// Parser issue codes -> plain words. Unknown codes fall back to the code itself.
function issueLabel(code: string): string {
  if (code.startsWith('missing_option_')) return `Option ${code.slice(15)} seems to be missing`
  if (code.startsWith('empty_option_')) return `Option ${code.slice(13)} is empty`
  const labels: Record<string, string> = {
    empty_stem: 'Question text is empty',
    short_stem: 'Question text looks too short',
    no_options: 'No options were found',
    too_few_options: 'Fewer than two options were found',
    non_contiguous_options: 'The option letters are out of order',
    key_letter_not_an_option: "The key's answer is not one of the options",
    ai_no_answer: 'The AI gave no answer',
  }
  return labels[code] ?? code
}

/** Problems visible in the question as it stands now. */
function liveProblems(question: Question): string[] {
  const problems: string[] = []
  const filled = Object.values(question.options).filter((text) => text.trim())
  if (!question.text.trim()) problems.push('Question text is empty')
  if (filled.length < 2) problems.push('Fewer than two options')
  if (!question.correct) problems.push('No correct answer set')
  else if (!question.options[question.correct]?.trim()) problems.push('The correct option is empty')
  return problems
}

function problemsFor(question: Question, edited: boolean): string[] {
  // Once the student has edited a question, the parser's notes are stale.
  const fromParser = edited ? [] : question.issues.map(issueLabel)
  return [...new Set([...liveProblems(question), ...fromParser])]
}

/** Drop empty options and trim text, so the quiz never shows a blank choice. */
function clean(question: Question): Question {
  const options = Object.fromEntries(
    Object.entries(question.options)
      .map(([letter, text]) => [letter, text.trim()] as const)
      .filter(([, text]) => text),
  )
  const valid = question.correct !== null && question.correct in options
  return {
    ...question,
    text: question.text.trim(),
    options,
    correct: valid ? question.correct : null,
    answer_source: valid ? question.answer_source : null,
  }
}

const SHOWN_WARNINGS = 6

export function ReviewScreen({ quiz, onStart }: Props) {
  const [questions, setQuestions] = useState(quiz.questions)
  const [edited, setEdited] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [showAllWarnings, setShowAllWarnings] = useState(false)

  // Sorted once, on arrival: rows must not jump around while being edited.
  const [order] = useState(() =>
    [...quiz.questions]
      .sort((a, b) => {
        const pa = problemsFor(a, false).length > 0 ? 0 : 1
        const pb = problemsFor(b, false).length > 0 ? 0 : 1
        return pa - pb || a.number - b.number
      })
      .map((q) => q.number),
  )

  const byNumber = new Map(questions.map((q) => [q.number, q]))
  const needLook = questions.filter((q) => problemsFor(q, edited.has(q.number)).length > 0).length
  const aiCount = questions.filter((q) => q.answer_source === 'ai').length
  const vision = quiz.pages.vision_pages
  const warnings = showAllWarnings ? quiz.warnings : quiz.warnings.slice(0, SHOWN_WARNINGS)

  function change(next: Question) {
    const before = byNumber.get(next.number)!
    setQuestions((current) => current.map((q) => (q.number === next.number ? next : q)))
    // Only fixing the text or options settles the parser's notes. Confirming
    // an answer says nothing about whether the question was read correctly.
    if (next.text !== before.text || next.options !== before.options) {
      setEdited((current) => new Set(current).add(next.number))
    }
  }

  function toggle(number: number) {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 pb-28">
      <p className="truncate text-sm text-slate-500 dark:text-slate-400">{quiz.title}</p>
      <h1 className="text-2xl font-semibold">Review</h1>
      <p className="mt-1 text-slate-600 dark:text-slate-400">
        {questions.length} questions
        {needLook > 0 && ` · ${needLook} need${needLook === 1 ? 's' : ''} a look`}
        {aiCount > 0 && ` · ${aiCount} AI-guessed`}
      </p>

      {(quiz.warnings.length > 0 || vision.length > 0) && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/50 dark:bg-amber-500/10">
          {quiz.warnings.length > 0 && (
            <>
              <p className="font-medium">
                {quiz.warnings.length} {quiz.warnings.length === 1 ? 'problem' : 'problems'} while
                reading the PDF:
              </p>
              <ul className="mt-2 list-disc pl-5">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning.message}</li>
                ))}
              </ul>
              {quiz.warnings.length > SHOWN_WARNINGS && (
                <button
                  type="button"
                  onClick={() => setShowAllWarnings((value) => !value)}
                  className="mt-1 min-h-11 underline"
                >
                  {showAllWarnings ? 'Show fewer' : `Show all ${quiz.warnings.length}`}
                </button>
              )}
            </>
          )}
          {vision.length > 0 && (
            <p className={quiz.warnings.length > 0 ? 'mt-2' : ''}>
              {vision.length === 1 ? 'Page' : 'Pages'} {vision.join(', ')}{' '}
              {vision.length === 1 ? 'was a scan' : 'were scans'} and{' '}
              {vision.length === 1 ? 'was' : 'were'} read by AI. Check those questions against the
              PDF for misreads.
            </p>
          )}
        </div>
      )}

      <ul className="mt-4 grid gap-2">
        {order.map((number) => {
          const question = byNumber.get(number)!
          return (
            <ReviewRow
              key={number}
              question={question}
              problems={problemsFor(question, edited.has(number))}
              expanded={expanded.has(number)}
              onToggle={() => toggle(number)}
              onChange={change}
            />
          )
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => onStart(questions.map(clean))}
            className="min-h-11 w-full rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700"
          >
            Start quiz
          </button>
        </div>
      </div>
    </main>
  )
}
