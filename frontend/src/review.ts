import type { ParseResponse } from './types'

/** Whether a parse has anything worth reviewing before the quiz. */
export function needsReview(quiz: ParseResponse): boolean {
  return (
    quiz.warnings.length > 0 ||
    quiz.pages.vision_pages.length > 0 ||
    quiz.questions.some((q) => q.answer_source === 'ai' || q.issues.length > 0 || !q.correct)
  )
}
