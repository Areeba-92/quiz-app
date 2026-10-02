import type { Answers, ParseResponse, Question, ScoreResponse } from './types'

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
