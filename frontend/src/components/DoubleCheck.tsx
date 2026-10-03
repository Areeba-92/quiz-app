import { useState } from 'react'
import { checkAnswer } from '../api'
import type { CheckResult, Question } from '../types'

interface Props {
  question: Question
  chosen: string | undefined
  result: CheckResult | undefined
  onChecked: (result: CheckResult) => void
}

/**
 * A second opinion during the quiz, for questions answered by the key.
 * It shows whether the student's pick matches the key, and whether OpenAI,
 * asked without seeing the key, agrees with it. The student's answer is
 * locked once checked, so the score still reflects what they knew.
 */
export function DoubleCheck({ question, chosen, result, onChecked }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setBusy(true)
    setError('')
    try {
      onChecked(await checkAnswer(question))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The check failed.')
    } finally {
      setBusy(false)
    }
  }

  const key = question.correct!
  const keyText = (letter: string) => `${letter}. ${question.options[letter] ?? ''}`

  if (!result) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={run}
          disabled={!chosen || busy}
          className="min-h-11 rounded-xl border border-indigo-600 px-4 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-transparent dark:border-indigo-400 dark:text-indigo-300 dark:hover:bg-indigo-500/10 dark:disabled:border-slate-700 dark:disabled:text-slate-500"
        >
          {busy ? 'Checking...' : 'Double check'}
        </button>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {chosen
            ? 'Shows if you match the key and asks OpenAI too. Your answer locks after.'
            : 'Pick an answer first.'}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
    )
  }

  const matchesKey = chosen === key
  const aiAgrees = result.ai_answer === key

  return (
    <div
      aria-live="polite"
      className="mt-3 grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p
        className={`flex items-start gap-2 ${matchesKey ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
      >
        <span aria-hidden="true">{matchesKey ? '✓' : '✗'}</span>
        <span>
          {matchesKey
            ? `Your answer ${chosen} matches the key.`
            : `Your answer ${chosen} does not match the key. Key: ${keyText(key)}`}
        </span>
      </p>
      <p
        className={`flex items-start gap-2 ${aiAgrees ? 'text-green-700 dark:text-green-300' : 'text-amber-800 dark:text-amber-300'}`}
      >
        <span aria-hidden="true">{aiAgrees ? '✓' : '⚠'}</span>
        <span>
          {aiAgrees
            ? `OpenAI agrees with the key: it also picks ${result.ai_answer}.`
            : `OpenAI disagrees with the key: it picks ${keyText(result.ai_answer)}`}
        </span>
      </p>
      {result.ai_reason && (
        <div className="rounded-lg bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <p className="mb-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
            OpenAI&apos;s reason
          </p>
          <p>{result.ai_reason}</p>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">Your answer is locked for this question.</p>
    </div>
  )
}
