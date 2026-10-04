import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionCard } from '../components/QuestionCard'
import { generateQuiz, type GenerateProgress } from '../generate'
import { UploadScreen } from '../screens/UploadScreen'
import type { GeneratePlan, GenerateSettings } from '../types'
import { parseResponse, question } from './fixtures'

vi.mock('../api', () => ({
  parsePdfs: vi.fn(),
  planQuiz: vi.fn(),
  generateChunk: vi.fn(),
  finishQuiz: vi.fn(),
}))

const { planQuiz, generateChunk, finishQuiz } = await import('../api')

const settings: GenerateSettings = { numQuestions: 6, difficulty: 'medium', scenarioBased: true }

function pdf() {
  return new File(['%PDF-1.4'], 'notes.pdf', { type: 'application/pdf' })
}

function plan(chunkPages: number[][]): GeneratePlan {
  return {
    title: 'Notes',
    pages: { total: 12, text_pages: 12, scanned_pages: [], vision_pages: [] },
    chunks: chunkPages.map((pages) => ({ pages, text: `text of ${pages.join(',')}`, count: 2 })),
    requested: 6,
    planned: 6,
    warnings: [],
  }
}

function generated(page: number) {
  return question(0, { answer_source: 'ai', generated: true, source_page: page })
}

beforeEach(() => {
  vi.mocked(planQuiz).mockReset()
  vi.mocked(generateChunk).mockReset()
  vi.mocked(finishQuiz).mockReset().mockImplementation(async (body) =>
    parseResponse({ title: body.title, questions: body.questions, warnings: body.warnings }),
  )
})

describe('generateQuiz', () => {
  it('runs every chunk, reports progress, and keeps page order', async () => {
    vi.mocked(planQuiz).mockResolvedValue(plan([[1, 2], [3, 4], [5, 6]]))
    // The first chunk finishes last; its questions must still come first.
    vi.mocked(generateChunk).mockImplementation(async (chunk) => {
      if (chunk.pages[0] === 1) await new Promise((resolve) => setTimeout(resolve, 20))
      return { questions: [generated(chunk.pages[0])], skipped: 1 }
    })
    const progress: GenerateProgress[] = []

    await generateQuiz(pdf(), settings, (p) => progress.push(p))

    expect(generateChunk).toHaveBeenCalledTimes(3)
    const body = vi.mocked(finishQuiz).mock.calls[0][0]
    expect(body.questions.map((q) => q.source_page)).toEqual([1, 3, 5])
    expect(body.skipped).toBe(3)
    expect(body.requested).toBe(6)
    expect(progress[0]).toEqual({ stage: 'reading' })
    expect(progress).toContainEqual({ stage: 'writing', done: 3, total: 3 })
    expect(progress.at(-1)).toEqual({ stage: 'finishing' })
  })

  it('turns a failed chunk into a warning and uses the rest', async () => {
    vi.mocked(planQuiz).mockResolvedValue(plan([[1, 2], [3, 4]]))
    vi.mocked(generateChunk).mockImplementation(async (chunk) => {
      if (chunk.pages[0] === 3) throw new Error('The OpenAI request failed: RateLimitError (HTTP 429)')
      return { questions: [generated(1)], skipped: 0 }
    })

    await generateQuiz(pdf(), settings, () => {})

    const body = vi.mocked(finishQuiz).mock.calls[0][0]
    expect(body.questions).toHaveLength(1)
    expect(body.warnings).toEqual([
      expect.objectContaining({
        code: 'generate_chunk_failed',
        message: 'Pages 3-4 could not be used: The OpenAI request failed: RateLimitError (HTTP 429)',
      }),
    ])
  })

  it('fails with the reason when no chunk worked', async () => {
    vi.mocked(planQuiz).mockResolvedValue(plan([[1]]))
    vi.mocked(generateChunk).mockRejectedValue(new Error('HTTP 500'))

    await expect(generateQuiz(pdf(), settings, () => {})).rejects.toThrow(
      'Page 1 could not be used: HTTP 500',
    )
    expect(finishQuiz).not.toHaveBeenCalled()
  })
})

describe('UploadScreen generate mode', () => {
  it('sends the settings and hands the result on', async () => {
    const user = userEvent.setup()
    const onReady = vi.fn()
    vi.mocked(planQuiz).mockResolvedValue(plan([[1, 2]]))
    vi.mocked(generateChunk).mockResolvedValue({ questions: [generated(2)], skipped: 0 })
    render(<UploadScreen onReady={onReady} />)

    await user.click(screen.getByRole('button', { name: 'Generate quiz from PDF' }))
    const generate = screen.getByRole('button', { name: 'Generate quiz' })
    expect(generate).toBeDisabled()

    await user.upload(screen.getByLabelText('Study PDF'), pdf())
    const count = screen.getByLabelText('Questions')
    await user.clear(count)
    await user.type(count, '12')
    await user.selectOptions(screen.getByLabelText('Difficulty'), 'hard')
    await user.click(screen.getByLabelText('Scenario-based questions'))
    await user.click(generate)

    await waitFor(() => expect(onReady).toHaveBeenCalled())
    expect(planQuiz).toHaveBeenCalledWith(expect.any(File), {
      numQuestions: 12,
      difficulty: 'hard',
      scenarioBased: false,
    })
  })

  it('blocks a question count out of range', async () => {
    const user = userEvent.setup()
    render(<UploadScreen onReady={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Generate quiz from PDF' }))
    await user.upload(screen.getByLabelText('Study PDF'), pdf())

    const count = screen.getByLabelText('Questions')
    await user.clear(count)
    await user.type(count, '80')

    expect(screen.getByText('Choose between 1 and 50 questions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate quiz' })).toBeDisabled()
  })
})

describe('a generated question', () => {
  it('shows the AI badge and its source page', () => {
    render(<QuestionCard question={generated(7)} chosen={undefined} onSelect={() => {}} />)
    expect(screen.getByText('AI-guessed')).toBeInTheDocument()
    expect(screen.getByText('Page 7')).toBeInTheDocument()
  })
})
