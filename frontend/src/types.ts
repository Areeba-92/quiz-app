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
}

export interface ScoreResponse {
  score_key_only: Score
  score_all: Score
  answered: number
  wrong: WrongAnswer[]
  unscored: number[]
}

/** Question number -> chosen letter. Never keyed by list position. */
export type Answers = Record<number, string>
