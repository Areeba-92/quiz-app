import { render, screen } from '@testing-library/react'
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

function pdf() {
  return new File(['%PDF-1.4'], 'quiz.pdf', { type: 'application/pdf' })
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(parsePdfs).mockReset().mockResolvedValue(parseResponse())
  vi.mocked(scoreAttempt).mockReset().mockResolvedValue(scoreResponse())
  // Not saved, so finishing goes through the stateless scorer.
  vi.mocked(saveQuiz).mockReset().mockRejectedValue(new Error('offline'))
  vi.mocked(submitAttempt).mockReset()
})

async function startQuiz(user: ReturnType<typeof userEvent.setup>) {
  render(<App />)
  await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
  await user.click(screen.getByRole('button', { name: 'Build quiz' }))
  await screen.findByText('1 / 3')
}

describe('Home', () => {
  it('asks before leaving a quiz, and Cancel keeps it', async () => {
    const user = userEvent.setup()
    await startQuiz(user)
    await user.click(screen.getByRole('radio', { name: /Option A: alpha/ }))

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByText('Leave this quiz? Your answers will be lost.')).toBeInTheDocument()
    // The safe choice has focus.
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByText(/Leave this quiz/)).not.toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Option A: alpha/ })).toBeChecked()
  })

  it('goes back to Upload and forgets the quiz', async () => {
    const user = userEvent.setup()
    await startQuiz(user)

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))

    expect(screen.getByRole('heading', { name: 'Build a quiz' })).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })

  it('asks on the review screen too', async () => {
    const user = userEvent.setup()
    vi.mocked(parsePdfs).mockResolvedValue(
      parseResponse({ questions: [question(1, { answer_source: 'ai' })] }),
    )
    render(<App />)
    await user.upload(screen.getByLabelText('Quiz PDF'), pdf())
    await user.click(screen.getByRole('button', { name: 'Build quiz' }))
    await screen.findByRole('heading', { name: 'Review' })

    await user.click(screen.getByRole('button', { name: 'Home' }))
    await user.click(screen.getByRole('button', { name: 'Leave' }))
    expect(screen.getByRole('heading', { name: 'Build a quiz' })).toBeInTheDocument()
  })

  it('leaves Results without asking', async () => {
    const user = userEvent.setup()
    await startQuiz(user)
    await user.click(screen.getByRole('button', { name: 'Finish now' }))
    await user.click(screen.getAllByRole('button', { name: 'Finish now' })[1])
    await screen.findByRole('heading', { name: 'Results' })

    await user.click(screen.getByRole('button', { name: 'Home' }))
    expect(screen.getByRole('heading', { name: 'Build a quiz' })).toBeInTheDocument()
  })
})

describe('Finish now', () => {
  it('says how many are unanswered before scoring early', async () => {
    const user = userEvent.setup()
    await startQuiz(user)
    await user.click(screen.getByRole('radio', { name: /Option A: alpha/ }))

    await user.click(screen.getByRole('button', { name: 'Finish now' }))
    expect(
      screen.getByText(/2 questions are not answered and will count as wrong/),
    ).toBeInTheDocument()
    expect(scoreAttempt).not.toHaveBeenCalled()

    // The strip's own button confirms; the header one opened it.
    await user.click(screen.getAllByRole('button', { name: 'Finish now' })[1])
    await screen.findByRole('heading', { name: 'Results' })
    expect(scoreAttempt).toHaveBeenCalledWith(expect.any(Array), { 1: 'A' })
  })

  it('Cancel goes back to answering', async () => {
    const user = userEvent.setup()
    await startQuiz(user)

    await user.click(screen.getByRole('button', { name: 'Finish now' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByText(/will count as wrong/)).not.toBeInTheDocument()
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(scoreAttempt).not.toHaveBeenCalled()
  })

  it('scores straight away when everything is answered', async () => {
    const user = userEvent.setup()
    await startQuiz(user)
    for (const option of [/Option A: alpha/, /Option B: beta/, /Option C: gamma/]) {
      await user.click(screen.getByRole('radio', { name: option }))
      if (!option.source.includes('gamma')) await user.click(screen.getByRole('button', { name: 'Next' }))
    }

    await user.click(screen.getByRole('button', { name: 'Finish now' }))
    await screen.findByRole('heading', { name: 'Results' })
    expect(scoreAttempt).toHaveBeenCalledTimes(1)
  })
})
