/**
 * SOUL.md principle 2: if Claude chose an answer, the app says so, every time.
 * Amber plus the words "AI-guessed" -- never colour on its own.
 */
export function AiBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-500/60 dark:bg-amber-500/15 dark:text-amber-200"
      title="Claude chose this answer. It may be wrong."
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-current">
        <path d="M8 1.5 9.6 6l4.4 1.6L9.6 9.2 8 13.6 6.4 9.2 2 7.6 6.4 6z" />
      </svg>
      AI-guessed
    </span>
  )
}
