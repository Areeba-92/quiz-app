import { useCallback, useEffect, useRef, useState } from 'react'
import { saveQuiz, scoreAttempt, submitAttempt } from './api'
import { needsReview } from './review'
import { QuizScreen } from './screens/QuizScreen'
import { ResultsScreen } from './screens/ResultsScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { UploadScreen } from './screens/UploadScreen'
import { loadSession, storeSession } from './session'
import type { Answers, CheckResult, Checks, ParseResponse, Question, ScoreResponse } from './types'

export default function App() {
  // Restored once on load, so a refresh lands back where the student was.
  const [saved] = useState(loadSession)
  const [quiz, setQuiz] = useState<ParseResponse | null>(saved?.quiz ?? null)
  const [quizId, setQuizId] = useState<number | null>(saved?.quizId ?? null)
  const [reviewing, setReviewing] = useState(saved?.reviewing ?? false)
  const [numbers, setNumbers] = useState<number[] | null>(saved?.numbers ?? null)
  const [round, setRound] = useState(saved?.round ?? 0)
  const [answers, setAnswers] = useState<Answers>(saved?.answers ?? {})
  const [checks, setChecks] = useState<Checks>(saved?.checks ?? {})
  const [flagged, setFlagged] = useState<Set<number>>(new Set(saved?.flagged ?? []))
  const [result, setResult] = useState<ScoreResponse | null>(saved?.result ?? null)
  const [scoring, setScoring] = useState(false)
  const [error, setError] = useState('')
  // Ignores a save that finishes after the student has already moved on.
  const saveToken = useRef(0)

  useEffect(() => {
    storeSession(
      quiz
        ? { quiz, quizId, reviewing, numbers, round, answers, checks, flagged: [...flagged], result }
        : null,
    )
  }, [quiz, quizId, reviewing, numbers, round, answers, checks, flagged, result])

  const answer = useCallback((number: number, letter: string) => {
    setAnswers((current) => ({ ...current, [number]: letter }))
  }, [])

  const checked = useCallback((number: number, check: CheckResult) => {
    setChecks((current) => ({ ...current, [number]: check }))
  }, [])

  const toggleFlag = useCallback((number: number) => {
    setFlagged((current) => {
      const next = new Set(current)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }, [])

  function begin(parsed: ParseResponse) {
    setQuiz(parsed)
    setReviewing(false)
    setQuizId(null)
    const token = ++saveToken.current
    saveQuiz(parsed.title, parsed.questions)
      .then((stored) => {
        if (token === saveToken.current) setQuizId(stored.id)
      })
      .catch(() => {
        // Saving is a bonus, not a gate: the quiz still runs, scored without storing.
      })
  }

  // A clean, fully key-backed parse goes straight to the quiz. Anything with
  // problems, AI answers or scanned pages stops on the review screen first.
  function ready(parsed: ParseResponse) {
    if (needsReview(parsed)) {
      setQuiz(parsed)
      setReviewing(true)
    } else {
      begin(parsed)
    }
  }

  function start(questions: Question[]) {
    if (quiz) begin({ ...quiz, questions, question_count: questions.length })
  }

  const inPlay = quiz
    ? numbers
      ? quiz.questions.filter((q) => numbers.includes(q.number))
      : quiz.questions
    : []

  async function finish() {
    setScoring(true)
    setError('')
    try {
      setResult(
        quizId !== null
          ? await submitAttempt(quizId, answers, inPlay.map((q) => q.number))
          : await scoreAttempt(inPlay, answers),
      )
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Scoring failed.')
    } finally {
      setScoring(false)
    }
  }

  function retryWrong() {
    if (!result) return
    setNumbers(result.wrong.map((item) => item.number))
    setAnswers({})
    setChecks({})
    setResult(null)
    setRound((value) => value + 1)
  }

  function reset() {
    saveToken.current++
    setQuiz(null)
    setQuizId(null)
    setReviewing(false)
    setNumbers(null)
    setRound(0)
    setAnswers({})
    setChecks({})
    setFlagged(new Set())
    setResult(null)
    setError('')
  }

  const title = quiz && numbers ? `${quiz.title} · retry of ${numbers.length}` : (quiz?.title ?? '')

  if (quiz && reviewing) {
    return <ReviewScreen quiz={quiz} onStart={start} />
  }

  if (quiz && result) {
    return (
      <ResultsScreen
        title={title}
        questions={inPlay}
        result={result}
        flagged={flagged}
        onRetry={retryWrong}
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
          key={round}
          title={title}
          questions={inPlay}
          answers={answers}
          flagged={flagged}
          onAnswer={answer}
          onToggleFlag={toggleFlag}
          onFinish={finish}
          busy={scoring}
          checks={checks}
          onChecked={checked}
        />
      </>
    )
  }

  return <UploadScreen onReady={ready} />
}
