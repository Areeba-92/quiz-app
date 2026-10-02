import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { parseResponse, question, scoreResponse } from './fixtures'

vi.mock('../api', () => ({
  parsePdfs: vi.fn(),
  scoreAttempt: vi.fn(),
}))

const { parsePdfs, scoreAttempt } = await import('../api')

function pdf(name = 'quiz.pdf') {
  return new File(['%PDF-1.4'], name, { type: 'application/pdf' })
}

beforeEach(() => {
  vi.mocked(parsePdfs).mockReset()
  vi.mocked(scoreAttempt).mockReset()
})

describe('the whole quiz flow', () => {
  it('goes upload -> quiz -> results', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(parseResponse())
    vi.mocked(scoreAttempt).mockResolvedValue(scoreResponse())

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

    // Answers were sent keyed by question number, never by position.
    expect(scoreAttempt).toHaveBeenCalledWith(expect.anything(), { 1: 'A', 2: 'B' })
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

  it('stops on extraction problems instead of hiding them', async () => {
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
    await screen.findByText(/Question 2 has no entry in the answer key./)
    expect(screen.queryByText('1 / 3')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start quiz anyway' }))
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
    vi.mocked(scoreAttempt).mockResolvedValue(
      scoreResponse({
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
      }),
    )

    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))

    await screen.findByText('1 / 1')
    expect(screen.getByText('AI-guessed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Finish' }))

    await screen.findByRole('heading', { name: 'Results' })
    expect(screen.getByText('Key-backed')).toBeInTheDocument()
    expect(screen.getAllByText('AI-guessed').length).toBeGreaterThan(0)
  })

  it('returns to the upload screen for a new quiz', async () => {
    const user = userEvent.setup()
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
    await user.click(screen.getByRole('button', { name: 'New quiz' }))

    expect(screen.getByRole('heading', { name: 'Build a quiz' })).toBeInTheDocument()
  })
})
