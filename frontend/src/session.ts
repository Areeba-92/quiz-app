import type { Answers, Checks, ParseResponse, ScoreResponse } from './types'

/**
 * The quiz in progress, kept in this browser so a refresh does not lose it.
 * Finished attempts live in the backend database; this is only the session.
 */
export interface Session {
  quiz: ParseResponse
  /** Id of the quiz saved in the backend, or null if saving failed. */
  quizId: number | null
  reviewing: boolean
  /** Question numbers in the current round. Null means the whole quiz. */
  numbers: number[] | null
  /** Bumped on every retry, so the quiz screen starts fresh. */
  round: number
  answers: Answers
  /** Double-check results; optional so sessions saved before this field still load. */
  checks?: Checks
  flagged: number[]
  result: ScoreResponse | null
}

const KEY = 'quiz-app-session'

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    // Blocked or corrupt storage: start fresh rather than fail.
    return null
  }
}

export function storeSession(session: Session | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // Storage full or blocked: the quiz still works, it just won't survive a refresh.
  }
}
