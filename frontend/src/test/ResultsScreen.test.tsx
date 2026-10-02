import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResultsScreen } from '../screens/ResultsScreen'
import { question, scoreResponse } from './fixtures'

const questions = [question(1), question(2), question(3)]

function renderResults(props: Partial<Parameters<typeof ResultsScreen>[0]> = {}) {
  return render(
    <ResultsScreen
      title="What Actually Is AI?"
      questions={questions}
      result={scoreResponse()}
      flagged={new Set()}
      onNewQuiz={() => {}}
      {...props}
    />,
  )
}

describe('ResultsScreen', () => {
  it('hides the key-backed score when nothing was AI-guessed', () => {
    renderResults()

    expect(screen.queryByText('Key-backed')).not.toBeInTheDocument()
    expect(screen.getByText('All questions')).toBeInTheDocument()
  })

  it('shows both scores when some answers came from Claude', () => {
    renderResults({
      questions: [question(1), question(2), question(3, { answer_source: 'ai' })],
      result: scoreResponse({
        score_key_only: { correct: 2, total: 2 },
        score_all: { correct: 2, total: 3 },
      }),
    })

    expect(screen.getByText('Key-backed')).toBeInTheDocument()
    expect(screen.getByText('All questions')).toBeInTheDocument()
    // The two scores must be visibly different, not merged into one number.
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('shows your answer, the correct answer and the reason for a wrong question', () => {
    renderResults()

    expect(screen.getByText(/Your answer:/)).toBeInTheDocument()
    expect(screen.getByText(/B\. beta/)).toBeInTheDocument()
    expect(screen.getByText(/Correct answer:/)).toBeInTheDocument()
    expect(screen.getByText(/A\. alpha/)).toBeInTheDocument()
    expect(screen.getByText('Reason for question 2')).toBeInTheDocument()
  })

  it('says so plainly when a question was left unanswered', () => {
    renderResults({
      result: scoreResponse({
        wrong: [
          {
            number: 2,
            text: 'Scenario for question 2',
            your_answer: null,
            correct: 'A',
            options: { A: 'alpha', B: 'beta' },
            explanation: null,
            explanation_source: null,
            answer_source: 'key',
          },
        ],
      }),
    })

    expect(screen.getByText('Not answered')).toBeInTheDocument()
  })

  it('filters by Wrong, All and Flagged', async () => {
    const user = userEvent.setup()
    renderResults({ flagged: new Set([3]) })

    // Wrong is the default tab.
    expect(screen.getByText('Scenario for question 2')).toBeInTheDocument()
    expect(screen.queryByText(/Question 1 /)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'All (3)' }))
    expect(screen.getByText('Question 1')).toBeInTheDocument()
    expect(screen.getByText('Question 3')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Flagged (1)' }))
    expect(screen.getByText('Question 3')).toBeInTheDocument()
    expect(screen.queryByText('Scenario for question 2')).not.toBeInTheDocument()
  })

  it('badges an AI-guessed wrong answer', () => {
    renderResults({
      questions: [question(1), question(2, { answer_source: 'ai' }), question(3)],
      result: scoreResponse({
        wrong: [
          {
            number: 2,
            text: 'Scenario for question 2',
            your_answer: 'B',
            correct: 'A',
            options: { A: 'alpha', B: 'beta' },
            explanation: 'Claude picked this',
            explanation_source: 'ai',
            answer_source: 'ai',
          },
        ],
      }),
    })

    expect(screen.getAllByText('AI-guessed').length).toBeGreaterThan(0)
  })

  it('reports questions that could not be marked', () => {
    renderResults({ result: scoreResponse({ unscored: [3] }) })
    expect(screen.getByText(/could not be marked/)).toBeInTheDocument()
  })

  it('keeps Retry wrong only disabled until phase 7, and starts a new quiz', async () => {
    const user = userEvent.setup()
    const onNewQuiz = vi.fn()
    renderResults({ onNewQuiz })

    expect(screen.getByRole('button', { name: 'Retry wrong only' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'New quiz' }))
    expect(onNewQuiz).toHaveBeenCalledOnce()
  })
})
