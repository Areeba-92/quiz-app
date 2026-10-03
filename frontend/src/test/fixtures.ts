import type { ParseResponse, Question, ScoreResponse } from '../types'

export function question(number: number, overrides: Partial<Question> = {}): Question {
  return {
    number,
    text: `Scenario for question ${number}`,
    options: { A: 'alpha', B: 'beta', C: 'gamma', D: 'delta' },
    correct: 'A',
    answer_source: 'key',
    explanation: `Reason for question ${number}`,
    explanation_source: 'key',
    issues: [],
    ...overrides,
  }
}

export function parseResponse(overrides: Partial<ParseResponse> = {}): ParseResponse {
  const questions = overrides.questions ?? [question(1), question(2), question(3)]
  return {
    title: 'What Actually Is AI?',
    question_count: questions.length,
    questions,
    warnings: [],
    pages: { total: 1, text_pages: 1, scanned_pages: [], vision_pages: [] },
    ...overrides,
  }
}

export function scoreResponse(overrides: Partial<ScoreResponse> = {}): ScoreResponse {
  return {
    score_key_only: { correct: 2, total: 3 },
    score_all: { correct: 2, total: 3 },
    answered: 3,
    wrong: [
      {
        number: 2,
        text: 'Scenario for question 2',
        your_answer: 'B',
        correct: 'A',
        options: { A: 'alpha', B: 'beta', C: 'gamma', D: 'delta' },
        explanation: 'Reason for question 2',
        explanation_source: 'key',
        answer_source: 'key',
      },
    ],
    unscored: [],
    ...overrides,
  }
}
