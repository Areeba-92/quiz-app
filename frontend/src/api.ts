import type {
  Answers,
  AttemptResponse,
  CheckResult,
  ParseResponse,
  Question,
  QuizSaved,
  ScoreResponse,
} from './types'

async function failure(response: Response): Promise<Error> {
  let detail = `Request failed (${response.status}).`
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') detail = body.detail
  } catch {
    // A non-JSON error body is not worth reporting over the status code.
  }
  return new Error(detail)
}

export async function parsePdfs(quiz: File, answerKey: File | null): Promise<ParseResponse> {
  const form = new FormData()
  form.append('quiz', quiz)
  if (answerKey) form.append('answer_key', answerKey)

  const response = await fetch('/parse', { method: 'POST', body: form })
  if (!response.ok) throw await failure(response)
  return response.json()
}

export async function scoreAttempt(
  questions: Question[],
  answers: Answers,
): Promise<ScoreResponse> {
  const response = await fetch('/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, answers }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Save the quiz as it starts, after any review edits. */
export async function saveQuiz(title: string, questions: Question[]): Promise<QuizSaved> {
  const response = await fetch('/quizzes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, questions }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Score an attempt against the saved quiz and store it. `numbers` is the round's questions. */
export async function submitAttempt(
  quizId: number,
  answers: Answers,
  numbers: number[],
): Promise<AttemptResponse> {
  const response = await fetch(`/quizzes/${quizId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, numbers }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Ask OpenAI for its own answer to one question, as a second opinion on the key. */
export async function checkAnswer(question: Question): Promise<CheckResult> {
  const response = await fetch('/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}
