/** Mirrors backend/app/schemas.py. Keep the two in step. */

export type Source = 'key' | 'ai'

export interface Question {
  number: number
  text: string
  options: Record<string, string>
  correct: string | null
  answer_source: Source | null
  explanation: string | null
  explanation_source: Source | null
  issues: string[]
  /** Written by the AI from a study PDF. Optional: sessions saved before this field lack it. */
  generated?: boolean
  /** The study PDF page a generated question was written from. */
  source_page?: number | null
}

export interface ParseWarning {
  code: string
  message: string
  page: number | null
  question_number: number | null
}

export interface PageInfo {
  total: number
  text_pages: number
  scanned_pages: number[]
  /** Scanned pages read by AI vision. Their text may hold misreads. */
  vision_pages: number[]
}

export interface ParseResponse {
  title: string
  question_count: number
  questions: Question[]
  warnings: ParseWarning[]
  pages: PageInfo
}

export interface Score {
  correct: number
  total: number
}

export interface WrongAnswer {
  number: number
  text: string
  your_answer: string | null
  correct: string
  options: Record<string, string>
  explanation: string | null
  explanation_source: Source | null
  answer_source: Source | null
  source_page?: number | null
}

export interface ScoreResponse {
  score_key_only: Score
  score_all: Score
  answered: number
  wrong: WrongAnswer[]
  unscored: number[]
}

export interface QuizSaved {
  id: number
  created_at: string
}

export interface AttemptResponse extends ScoreResponse {
  attempt_id: number
  quiz_id: number
}

/** OpenAI's own pick for one question, made without seeing the key. */
export interface CheckResult {
  ai_answer: string
  ai_reason: string
}

/** Question number -> double-check result. A checked question's answer is locked. */
export type Checks = Record<number, CheckResult>

export type Difficulty = 'easy' | 'medium' | 'hard'

export interface GenerateSettings {
  numQuestions: number
  difficulty: Difficulty
  scenarioBased: boolean
}

/** A few pages of a study PDF, and how many questions to write from them. */
export interface GenerateChunk {
  pages: number[]
  text: string
  count: number
}

export interface GeneratePlan {
  title: string
  pages: PageInfo
  chunks: GenerateChunk[]
  requested: number
  planned: number
  warnings: ParseWarning[]
}

export interface ChunkResult {
  questions: Question[]
  /** Items the AI returned that broke a rule and were dropped. */
  skipped: number
}

/** Question number -> chosen letter. Never keyed by list position. */
export type Answers = Record<number, string>
