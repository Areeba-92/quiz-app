import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { needsReview } from '../review'
import { ReviewScreen } from '../screens/ReviewScreen'
import type { Question } from '../types'
import { parseResponse, question } from './fixtures'

function renderReview(questions: Question[], overrides = {}) {
  const onStart = vi.fn()
  render(<ReviewScreen quiz={parseResponse({ questions, ...overrides })} onStart={onStart} />)
  return { onStart, user: userEvent.setup() }
}

const aiQuestion = (number: number) =>
  question(number, {
    answer_source: 'ai',
    explanation: 'AI reason',
    explanation_source: 'ai',
  })

function rows() {
  return screen.getAllByRole('button', { expanded: false }).filter((b) => b.hasAttribute('aria-controls'))
}

describe('ReviewScreen', () => {
  it('sorts questions with problems to the top and marks them', () => {
    renderReview([question(1), question(2, { correct: null, answer_source: null }), question(3)])

    expect(rows()[0]).toHaveTextContent('Q2')
    expect(within(rows()[0]).getByText(/Needs a look: No correct answer set/)).toBeInTheDocument()
    expect(screen.getByText(/1 needs a look/)).toBeInTheDocument()
  })

  it('turns parser issue codes into plain words', async () => {
    const { user } = renderReview([question(1, { issues: ['missing_option_C'] })])
    await user.click(rows()[0])

    expect(screen.getAllByText('Option C seems to be missing').length).toBeGreaterThan(0)
  })

  it('overrides an AI answer with one tap, dropping the badge and the stale reason', async () => {
    const { user, onStart } = renderReview([aiQuestion(1)])
    expect(screen.getByText('AI-guessed')).toBeInTheDocument()

    await user.click(rows()[0])
    await user.click(screen.getByRole('radio', { name: 'Correct answer C' }))
    expect(screen.queryByText('AI-guessed')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    const [started] = onStart.mock.calls[0][0]
    expect(started).toMatchObject({
      correct: 'C',
      answer_source: 'key',
      explanation: null,
      explanation_source: null,
    })
  })

  it('confirms an AI answer by tapping its own letter, keeping the reason', async () => {
    const { user, onStart } = renderReview([aiQuestion(1)])
    await user.click(rows()[0])
    await user.click(screen.getByRole('radio', { name: 'Correct answer A' }))

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(onStart.mock.calls[0][0][0]).toMatchObject({
      correct: 'A',
      answer_source: 'key',
      explanation: 'AI reason',
    })
  })

  it('edits the question text and options, and drops empty options on start', async () => {
    const { user, onStart } = renderReview([
      question(1, { options: { A: 'alpha', B: 'beta', C: 'gamma', D: 'delta' } }),
    ])
    await user.click(rows()[0])

    const text = screen.getByLabelText('Question text')
    await user.clear(text)
    await user.type(text, 'Fixed wording')
    await user.clear(screen.getByLabelText('Option D'))

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    const [started] = onStart.mock.calls[0][0]
    expect(started.text).toBe('Fixed wording')
    expect(started.options).toEqual({ A: 'alpha', B: 'beta', C: 'gamma' })
  })

  it('unsets the answer if its option was emptied', async () => {
    const { user, onStart } = renderReview([question(1)])
    await user.click(rows()[0])
    await user.clear(screen.getByLabelText('Option A'))
    expect(screen.getAllByText('The correct option is empty').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: 'Start quiz' }))
    expect(onStart.mock.calls[0][0][0]).toMatchObject({ correct: null, answer_source: null })
  })

  it('shows the parse warnings and which pages were read from scans', () => {
    renderReview([question(1)], {
      warnings: [{ code: 'x', message: 'Numbering jumps from 4 to 6.', page: null, question_number: 6 }],
      pages: { total: 2, text_pages: 1, scanned_pages: [2], vision_pages: [2] },
    })

    expect(screen.getByText('Numbering jumps from 4 to 6.')).toBeInTheDocument()
    expect(screen.getByText(/Page 2 was a scan and was read by AI/)).toBeInTheDocument()
  })
})

describe('needsReview', () => {
  it('skips review for a clean, fully key-backed parse', () => {
    expect(needsReview(parseResponse())).toBe(false)
  })

  it('asks for review when anything was AI-guessed', () => {
    expect(needsReview(parseResponse({ questions: [aiQuestion(1)] }))).toBe(true)
  })
})
