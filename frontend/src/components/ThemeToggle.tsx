import { useState } from 'react'
import { loadTheme, saveTheme, type Theme } from '../theme'

const CHOICES: { value: Theme; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(loadTheme)

  function choose(next: Theme) {
    setTheme(next)
    saveTheme(next)
  }

  return (
    <div className="text-sm">
      {/* Read out, not shown: the three choices explain themselves next to the heading. */}
      <span id="theme-label" className="sr-only">
        Theme
      </span>
      <div
        role="radiogroup"
        aria-labelledby="theme-label"
        className="flex rounded-xl border border-slate-300 p-0.5 dark:border-slate-700"
      >
        {CHOICES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => choose(value)}
            className={[
              'min-h-11 rounded-lg px-3',
              theme === value
                ? 'bg-indigo-600 font-medium text-white dark:bg-indigo-500'
                : 'text-slate-700 dark:text-slate-300',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
