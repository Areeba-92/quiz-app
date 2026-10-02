import { useCallback, useState } from 'react'
import { scoreAttempt } from './api'
import { QuizScreen } from './screens/QuizScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { UploadScreen } from './screens/UploadScreen'
import type { Answers, ParseResponse, ScoreResponse } from './types'

export default function App() {
  const [quiz, setQuiz] = useState<ParseResponse | null>(null)
  const [answers, setAnswers] = useState<Answers>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [result, setResult] = useState<ScoreResponse | null>(null)
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState('')

  const answer = useCallback((number: number, letter: string) => {
    setAnswers((current) => ({ ...current, [number]: letter }))
  }, [])

  const toggleFlag = useCallback((number: number) => {
    setFlagged((current) => {
      const next = new Set(current)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }, [])

  async function finish() {
    if (!quiz) return
    setScoring(true)
    setError('')
    try {
      setResult(await scoreAttempt(quiz.questions, answers))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  function reset() {
    setQuiz(null)
    setAnswers({})
    setFlagged(new Set())
    setResult(null)
    setError('')
  }

  if (quiz && result) {
    return (
      <ResultsScreen
        title={quiz.title}
        questions={quiz.questions}
        result={result}
        flagged={flagged}
        onNewQuiz={reset}
      />
    )
  }

  if (quiz) {
    return (
      <>
        {error && (
          <p role="alert" className="bg-red-600 p-2 text-center text-sm text-white">
            {error}
          </p>
        )}
        <QuizScreen
          title={quiz.title}
          questions={quiz.questions}
          answers={answers}
          flagged={flagged}
          onAnswer={answer}
          onToggleFlag={toggleFlag}
          onFinish={finish}
          busy={scoring}
        />
      </>
    )
  }

  return <UploadScreen onReady={setQuiz} />
}
