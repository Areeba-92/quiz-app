import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { QuizScreen } from '../screens/QuizScreen'
import type { Answers } from '../types'
import { question } from './fixtures'

const questions = [question(1), question(2), question(3)]

/** Wraps the screen in the answer/flag state App normally owns. */
function Harness({ onFinish = () => {} }: { onFinish?: () => void }) {
  const [answers, setAnswers] = useState<Answers>({})
  const [flagged, setFlagged] = useState<Set<number>>(new Set())

  return (
    <QuizScreen
      title="What Actually Is AI?"
      questions={questions}
      answers={answers}
      flagged={flagged}
      onAnswer={(number, letter) => setAnswers((a) => ({ ...a, [number]: letter }))}
      onToggleFlag={(number) =>
        setFlagged((f) => {
          const next = new Set(f)
          next.has(number) ? next.delete(number) : next.add(number)
          return next
        })
      }
      onFinish={onFinish}
    />
  )
}

describe('QuizScreen', () => {
  it('shows one question at a time with progress', () => {
    render(<Harness />)

    expect(screen.getByText('1 / 3')).toBeInTheDocument()
    expect(screen.getByText('Scenario for question 1')).toBeInTheDocument()
    expect(screen.queryByText('Scenario for question 2')).not.toBeInTheDocument()
  })

  it('selects an option without revealing whether it is right', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    const option = screen.getByRole('radio', { name: /Option A: alpha/ })
    await user.click(option)

    expect(option).toHaveAttribute('aria-checked', 'true')
    // DESIGN.md: nothing on this screen may say correct or wrong.
    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Reason for question/)).not.toBeInTheDocument()
  })

  it('moves between questions with Previous and Next', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Previous' })[0])
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('turns Next into Finish on the last question', async () => {
    const user = userEvent.setup()
    const onFinish = vi.fn()
    render(<Harness onFinish={onFinish} />)

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('3 / 3')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Finish' }))
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('selects options with the A to D keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('c')
    expect(screen.getByRole('radio', { name: /Option C: gamma/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('moves between questions with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('{ArrowRight}')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()

    await user.keyboard('{ArrowLeft}')
    expect(screen.getByText('1 / 3')).toBeInTheDocument()
  })

  it('flags a question with the F key and with the button', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.keyboard('f')
    expect(screen.getByRole('button', { name: 'Flagged' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await user.click(screen.getByRole('button', { name: 'Flagged' }))
    expect(screen.getByRole('button', { name: 'Flag' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('tracks answered count and lets the navigator jump', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('radio', { name: /Option A: alpha/ }))
    expect(screen.getByText('1 answered')).toBeInTheDocument()

    const navigator = screen.getAllByRole('navigation', { name: 'Question navigator' })[0]
    await user.click(within(navigator).getByRole('button', { name: /Question 3/ }))
    expect(screen.getByText('3 / 3')).toBeInTheDocument()
  })

  it('shows the AI-guessed badge only when the answer came from Claude', () => {
    const { unmount } = render(<Harness />)
    expect(screen.queryByText('AI-guessed')).not.toBeInTheDocument()
    unmount()

    render(
      <QuizScreen
        title="t"
        questions={[question(1, { answer_source: 'ai' })]}
        answers={{}}
        flagged={new Set()}
        onAnswer={() => {}}
        onToggleFlag={() => {}}
        onFinish={() => {}}
      />,
    )
    expect(screen.getByText('AI-guessed')).toBeInTheDocument()
  })
})
