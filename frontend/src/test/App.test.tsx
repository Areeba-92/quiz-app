import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { parseResponse, question, scoreResponse } from './fixtures'

vi.mock('../api', () => ({
  parsePdfs: vi.fn(),
  scoreAttempt: vi.fn(),
  saveQuiz: vi.fn(),
  submitAttempt: vi.fn(),
}))

const { parsePdfs, scoreAttempt, saveQuiz, submitAttempt } = await import('../api')

function pdf(name = 'quiz.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(parsePdfs).mockReset()
  vi.mocked(scoreAttempt).mockReset()
  vi.mocked(saveQuiz).mockReset().mockResolvedValue({ id: 7, created_at: '2026-10-03T00:00:00+00:00' })
  vi.mocked(submitAttempt).mockReset()
})

/** submitAttempt answers with the attempt fields on top of a score. */
function attempt(score = scoreResponse()) {
  return { ...score, attempt_id: 1, quiz_id: 7 }
}

describe('the whole quiz flow', () => {
  it('goes upload -> quiz -> results', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())
    vi.mocked(submitAttempt).mockResolvedValue(attempt())

    render(<App />)

    // Upload: the button stays disabled until a quiz PDF is chosen.
    const build = screen.getByRole('button', { name: 'Build quiz' })
    expect(build).toBeDisabled()

    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    expect(build).toBeEnabled()
    await user.click(build)

    // Quiz: a clean parse goes straight in, with no extra tap.
    await screen.findByText('1 / 3')
    await user.click(screen.getByRole('radio', { name: /Option A: alpha/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('radio', { name: /Option B: beta/ }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    // Results.
    await screen.findByRole('heading', { name: 'Results' })
    expect(screen.getByText('All questions')).toBeInTheDocument()

    // The quiz was saved as it started, and the attempt scored against it,
    // with answers keyed by question number, never by position.
    expect(saveQuiz).toHaveBeenCalledWith('What Actually Is AI?', expect.any(Array))
    expect(submitAttempt).toHaveBeenCalledWith(7, { 1: 'A', 2: 'B' }, [1, 2, 3])
  })

  it('sends the answer key when one is chosen', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())

    render(<App />)
    const quiz = pdf()
    const key = pdf('key.pdf')
    await user.upload(screen.getByLabelText('Quiz PDF'), quiz)
    await user.upload(screen.getByLabelText('Answer key PDF'), key)
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    await waitFor(() => expect(parsePdfs).toHaveBeenCalledWith(quiz, key))
  })

  it('stops on the review screen for extraction problems instead of hiding them', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(
      parseResponse({
        warnings: [
          {
            code: 'question_missing_key_entry',
            message: 'Question 2 has no entry in the answer key.',
            page: null,
            question_number: 2,
          },
        ],
      }),
    )

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    // The quiz does not start until the student has seen the problem.
    await screen.findByRole('heading', { name: 'Review' })
    expect(screen.getByText(/Question 2 has no entry in the answer key./)).toBeInTheDocument()
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('stops to say which pages were read from scans', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(
      parseResponse({ pages: { total: 3, text_pages: 1, scanned_pages: [2, 3], vision_pages: [2, 3] } }),
    )

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    await screen.findByText(/Pages 2, 3 were scans and were read by AI/)
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('shows a plain message when the PDF cannot be read', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockRejectedValue(new Error('The uploaded file is not a PDF.'))

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf('notes.txt'))
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('The uploaded file is not a PDF.')
  })

  it('carries the AI-guessed badge from the quiz through to the results', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(
      parseResponse({ questions: [question(1, { answer_source: 'ai' })] }),
    )
    vi.mocked(submitAttempt).mockResolvedValue(
      attempt(scoreResponse({
        score_key_only: { correct: 0, total: 0 },
        score_all: { correct: 0, total: 1 },
        wrong: [
          {
            number: 1,
            text: 'Scenario for question 1',
            your_answer: 'B',
            correct: 'A',
            options: { A: 'alpha', B: 'beta' },
            explanation: 'Claude picked this',
            explanation_source: 'ai',
            answer_source: 'ai',
          },
        ],
      })),
    )

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    // AI answers always pass through review first.
    await screen.findByRole('heading', { name: 'Review' })
    await user.click(screen.getByRole('button', { name: 'Start quiz' }))

    await screen.findByText('1 / 1')
    expect(screen.getByText('AI-guessed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish' }))

    await screen.findByRole('heading', { name: 'Results' })
    // No question came from a key, so a "0 / 0" key-backed score is not shown.
    expect(screen.queryByText('Key-backed')).not.toBeInTheDocument()
    expect(screen.getAllByText('AI-guessed').length).toBeGreaterThan(0)
  })

  it('still scores the quiz when saving it failed', async () => {
    const user = userEvent.setup()
    vi.mocked(saveQuiz).mockRejectedValue(new Error('database locked'))
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())
    vi.mocked(scoreAttempt).mockResolvedValue(scoreResponse())

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))
    await screen.findByText('1 / 3')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    await screen.findByRole('heading', { name: 'Results' })
    expect(scoreAttempt).toHaveBeenCalled()
    expect(submitAttempt).not.toHaveBeenCalled()
  })

  it('retries only the wrong questions, as a new saved attempt', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())
    // Question 2 is wrong in the fixture score.
    vi.mocked(submitAttempt).mockResolvedValue(attempt())

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))
    await screen.findByText('1 / 3')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    await screen.findByRole('heading', { name: 'Results' })
    await user.click(screen.getByRole('button', { name: 'Retry wrong only (1)' }))

    // A fresh round with only question 2, starting unanswered.
    expect(screen.getByText('1 / 1')).toBeInTheDocument()
    expect(screen.getByText('Question 2')).toBeInTheDocument()
    expect(screen.getByText('0 answered')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /Option A: alpha/ }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    await waitFor(() => expect(submitAttempt).toHaveBeenLastCalledWith(7, { 2: 'A' }, [2]))
  })

  it('comes back to the same quiz and answers after a refresh', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())

    const first = render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))
    await screen.findByText('1 / 3')
    await user.click(screen.getByRole('radio', { name: /Option C: gamma/ }))
    await waitFor(() => expect(saveQuiz).toHaveBeenCalled())
    first.unmount()

    // A new App, as after a page reload.
    render(<App />)
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('1 answered')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Option C: gamma/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('returns to the upload screen for a new quiz', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())
    vi.mocked(submitAttempt).mockResolvedValue(attempt())

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))
    await screen.findByText('1 / 3')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Finish' }))

    await screen.findByRole('heading', { name: 'Results' })
    await user.click(screen.getByRole('button', { name: 'New quiz' }))

    expect(screen.getByRole('heading', { name: 'Build a quiz' })).toBeInTheDocument()
  })
})
