/**
 * Light, dark, or follow the system. The choice is kept in this browser and
 * applied as `data-theme` on <html>, which the `dark:` variant in index.css
 * keys off. index.html applies the same rule before React loads, so the page
 * never flashes the wrong theme.
 */

export type Theme = 'system' | 'light' | 'dark'

const KEY = 'quiz-app-theme'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

export function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' ? stored : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function saveTheme(theme: Theme): void {
  try {
    if (theme === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, theme)
  } catch {
    // Blocked storage: the theme still applies, it just won't be remembered.
  }
  applyTheme(theme)
}

/** Apply the saved theme, and keep following the system while set to System. */
export function initTheme(): void {
  applyTheme(loadTheme())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (loadTheme() === 'system') applyTheme('system')
  })
}
