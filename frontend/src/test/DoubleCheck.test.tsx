import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuizScreen } from '../screens/QuizScreen'
import type { Answers, Checks, Question } from '../types'
import { question } from './fixtures'

vi.mock('../api', () => ({ checkAnswer: vi.fn() }))
const { checkAnswer } = await import('../api')

/** QuizScreen with real answer and check state, as App wires it. */
function Harness({ questions }: { questions: Question[] }) {
  const [answers, setAnswers] = useState<Answers>({})
  const [checks, setChecks] = useState<Checks>({})
  return (
    <QuizScreen
      title="Quiz"
      questions={questions}
      answers={answers}
      flagged={new Set()}
      onAnswer={(n, l) => setAnswers((a) => ({ ...a, [n]: l }))}
      onToggleFlag={() => {}}
      onFinish={() => {}}
      checks={checks}
      onChecked={(n, r) => setChecks((c) => ({ ...c, [n]: r }))}
    />
  )
}

// Braces matter: a function returned from beforeEach is run as a cleanup step.
beforeEach(() => {
  vi.mocked(checkAnswer).mockReset()
})

describe('Double check', () => {
  it('needs an answer first, so it cannot be used to look the answer up', () => {
    render(<Harness questions={[question(1)]} />)
    expect(screen.getByRole('button', { name: 'Double check' })).toBeDisabled()
    expect(screen.getByText('Pick an answer first.')).toBeInTheDocument()
  })

  it('is not offered when the answer came from the AI rather than a key', () => {
    render(<Harness questions={[question(1, { answer_source: 'ai' })]} />)
    expect(screen.queryByRole('button', { name: 'Double check' })).not.toBeInTheDocument()
  })

  it('shows a match with the key and OpenAI agreeing, then locks the answer', async () => {
    const user = userEvent.setup()
    vi.mocked(checkAnswer).mockResolvedValue({ ai_answer: 'A', ai_reason: 'Alpha fits.' })
    render(<Harness questions={[question(1)]} />)

    await user.click(screen.getByRole('radio', { name: /Option A/ }))
    await user.click(screen.getByRole('button', { name: 'Double check' }))

    expect(await screen.findByText('Your answer A matches the key.')).toBeInTheDocument()
    expect(screen.getByText('OpenAI agrees with the key: it also picks A.')).toBeInTheDocument()
    expect(screen.getByText('Alpha fits.')).toBeInTheDocument()

    // Locked: neither a tap nor the keyboard can change it now.
    expect(screen.getByRole('radio', { name: /Option B/ })).toBeDisabled()
    await user.keyboard('b')
    expect(screen.getByRole('radio', { name: /Option A/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('shows a wrong answer and OpenAI disagreeing with the key', async () => {
    const user = userEvent.setup()
    vi.mocked(checkAnswer).mockResolvedValue({ ai_answer: 'C', ai_reason: 'Gamma is better.' })
    render(<Harness questions={[question(1)]} />)

    await user.click(screen.getByRole('radio', { name: /Option B/ }))
    await user.click(screen.getByRole('button', { name: 'Double check' }))

    expect(
      await screen.findByText('Your answer B does not match the key. Key: A. alpha'),
    ).toBeInTheDocument()
    expect(screen.getByText('OpenAI disagrees with the key: it picks C. gamma')).toBeInTheDocument()
  })

  it('shows a plain error and leaves the answer unlocked when the check fails', async () => {
    const user = userEvent.setup()
    vi.mocked(checkAnswer).mockImplementation(async () => {
      throw new Error('OpenAI is not set up.')
    })
    render(<Harness questions={[question(1)]} />)

    await user.click(screen.getByRole('radio', { name: /Option A/ }))
    await user.click(screen.getByRole('button', { name: 'Double check' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('OpenAI is not set up.')
    expect(screen.getByRole('radio', { name: /Option B/ })).toBeEnabled()
  })
})
