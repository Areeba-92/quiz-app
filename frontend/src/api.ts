import type {
  Answers,
  AttemptResponse,
  CheckResult,
  ChunkResult,
  GenerateChunk,
  GeneratePlan,
  GenerateSettings,
  PageInfo,
  ParseWarning,
  ParseResponse,
  Question,
  QuizSaved,
  ScoreResponse,
} from './types'

// The backend host in production (set VITE_API_URL on Vercel). Empty in local
// dev, so calls stay relative and go through the Vite proxy.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// Vercel rejects function request bodies over 4.5 MB before the backend sees them.
const MAX_DEPLOYED_UPLOAD_BYTES = 4 * 1024 * 1024

async function failure(response: Response): Promise<Error> {
  let detail = `Request failed (${response.status}).`
  try {
    const body = await response.json()
    if (typeof body?.detail === 'string') detail = body.detail
  } catch {
    // A non-JSON error body is not worth reporting over the status code.
  }
  if (response.status === 413) {
    detail = 'The PDFs are too large to upload. Keep the quiz and answer key under 4 MB together.'
  }
  return new Error(detail)
}

function checkUploadSize(size: number, message: string) {
  if (API_BASE && size > MAX_DEPLOYED_UPLOAD_BYTES) throw new Error(message)
}

export async function parsePdfs(quiz: File, answerKey: File | null): Promise<ParseResponse> {
  checkUploadSize(
    quiz.size + (answerKey?.size ?? 0),
    'The PDFs are too large to upload. Keep the quiz and answer key under 4 MB together.',
  )

  const form = new FormData()
  form.append('quiz', quiz)
  if (answerKey) form.append('answer_key', answerKey)

  const response = await fetch(`${API_BASE}/parse`, { method: 'POST', body: form })
  if (!response.ok) throw await failure(response)
  return response.json()
}

export async function scoreAttempt(
  questions: Question[],
  answers: Answers,
): Promise<ScoreResponse> {
  const response = await fetch(`${API_BASE}/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questions, answers }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Save the quiz as it starts, after any review edits. */
export async function saveQuiz(title: string, questions: Question[]): Promise<QuizSaved> {
  const response = await fetch(`${API_BASE}/quizzes`, {
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
  const response = await fetch(`${API_BASE}/quizzes/${quizId}/attempts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ answers, numbers }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Ask OpenAI for its own answer to one question, as a second opinion on the key. */
export async function checkAnswer(question: Question): Promise<CheckResult> {
  const response = await fetch(`${API_BASE}/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Step 1 of generating: read the study PDF and split it into chunks. */
export async function planQuiz(pdf: File, settings: GenerateSettings): Promise<GeneratePlan> {
  checkUploadSize(pdf.size, 'The PDF is too large to upload. Keep it under 4 MB.')

  const form = new FormData()
  form.append('pdf', pdf)
  form.append('num_questions', String(settings.numQuestions))
  form.append('difficulty', settings.difficulty)
  form.append('scenario_based', String(settings.scenarioBased))

  const response = await fetch(`${API_BASE}/generate-quiz`, { method: 'POST', body: form })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Step 2: write the questions for one chunk. */
export async function generateChunk(
  chunk: GenerateChunk,
  settings: GenerateSettings,
): Promise<ChunkResult> {
  const response = await fetch(`${API_BASE}/generate-quiz/chunk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      pages: chunk.pages,
      text: chunk.text,
      count: chunk.count,
      difficulty: settings.difficulty,
      scenario_based: settings.scenarioBased,
    }),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}

/** Step 3: de-duplicate and number everything, as a normal parse result. */
export async function finishQuiz(body: {
  title: string
  pages: PageInfo
  questions: Question[]
  requested: number
  skipped: number
  warnings: ParseWarning[]
}): Promise<ParseResponse> {
  const response = await fetch(`${API_BASE}/generate-quiz/finish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await failure(response)
  return response.json()
}
