import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from '../components/ThemeToggle'
import { initTheme } from '../theme'

function mockSystem(dark: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: dark,
    addEventListener: vi.fn(),
  }) as unknown as typeof window.matchMedia
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme', () => {
  it('follows the system by default', () => {
    mockSystem(true)
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('lets the student force light even when the system is dark, and remembers it', async () => {
    mockSystem(true)
    initTheme()
    render(<ThemeToggle />)
    expect(screen.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')

    await userEvent.click(screen.getByRole('radio', { name: 'Light' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('quiz-app-theme')).toBe('light')

    // As after a reload.
    delete document.documentElement.dataset.theme
    initTheme()
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('goes back to following the system when System is chosen', async () => {
    mockSystem(false)
    localStorage.setItem('quiz-app-theme', 'dark')
    initTheme()
    render(<ThemeToggle />)
    expect(document.documentElement.dataset.theme).toBe('dark')

    await userEvent.click(screen.getByRole('radio', { name: 'System' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('quiz-app-theme')).toBeNull()
  })
})
