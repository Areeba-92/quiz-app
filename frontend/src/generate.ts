import { finishQuiz, generateChunk, planQuiz } from './api'
import type { GenerateSettings, ParseResponse, ParseWarning, Question } from './types'

/** Chunk calls in flight at once. Faster than one by one, gentle on the API. */
const PARALLEL_CHUNKS = 3

export type GenerateProgress =
  | { stage: 'reading' }
  | { stage: 'writing'; done: number; total: number }
  | { stage: 'finishing' }

function pageRange(pages: number[]): string {
  const first = pages[0]
  const last = pages[pages.length - 1]
  return first === last ? `Page ${first}` : `Pages ${first}-${last}`
}

/**
 * Study PDF -> generated quiz, one chunk of pages per request, so no single
 * request comes near the server's time limit. A failed chunk becomes a warning;
 * the quiz is built from the chunks that worked.
 */
export async function generateQuiz(
  pdf: File,
  settings: GenerateSettings,
  onProgress: (progress: GenerateProgress) => void,
): Promise<ParseResponse> {
  onProgress({ stage: 'reading' })
  const plan = await planQuiz(pdf, settings)
  const total = plan.chunks.length

  // Kept per chunk, so questions stay in page order whatever finishes first.
  const results: Question[][] = plan.chunks.map(() => [])
  const failures: ParseWarning[] = []
  let skipped = 0
  let done = 0
  let next = 0
  onProgress({ stage: 'writing', done, total })

  async function worker() {
    while (next < total) {
      const index = next++
      const chunk = plan.chunks[index]
      try {
        const result = await generateChunk(chunk, settings)
        results[index] = result.questions
        skipped += result.skipped
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : 'it failed'
        failures.push({
          code: 'generate_chunk_failed',
          message: `${pageRange(chunk.pages)} could not be used: ${reason}`,
          page: chunk.pages[0],
          question_number: null,
        })
      }
      done += 1
      onProgress({ stage: 'writing', done, total })
    }
  }

  await Promise.all(Array.from({ length: Math.min(PARALLEL_CHUNKS, total) }, worker))

  const questions = results.flat()
  if (questions.length === 0) {
    throw new Error(failures[0]?.message ?? 'No questions could be generated from this PDF.')
  }

  onProgress({ stage: 'finishing' })
  failures.sort((a, b) => (a.page ?? 0) - (b.page ?? 0))
  return finishQuiz({
    title: plan.title,
    pages: plan.pages,
    questions,
    requested: plan.requested,
    skipped,
    warnings: [...plan.warnings, ...failures],
  })
}
