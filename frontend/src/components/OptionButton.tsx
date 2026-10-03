interface Props {
  letter: string
  text: string
  selected: boolean
  /** After a double check the answer can no longer change. */
  locked?: boolean
  onSelect: (letter: string) => void
}

/**
 * DESIGN.md: selecting highlights, it never reveals whether the choice is
 * right. Answers appear on the Results screen and nowhere else.
 */
export function OptionButton({ letter, text, selected, locked = false, onSelect }: Props) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      // Set explicitly: built from the contents, the name would come out as
      // "Option A:alpha", because the accessible name algorithm trims each
      // text node before joining them.
      aria-label={`Option ${letter}: ${text}`}
      onClick={() => onSelect(letter)}
      disabled={locked}
      className={[
        'disabled:cursor-default',
        'flex w-full min-h-11 items-start gap-3 rounded-xl border p-3 text-left transition-colors',
        selected
          ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-400 dark:bg-indigo-500/15'
          : 'border-slate-200 bg-white enabled:hover:border-slate-300 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:enabled:hover:border-slate-700',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={[
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold',
          selected
            ? 'border-indigo-600 bg-indigo-600 text-white dark:border-indigo-400 dark:bg-indigo-500'
            : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400',
        ].join(' ')}
      >
        {letter}
      </span>
      <span aria-hidden="true" className="min-w-0 break-words pt-0.5">
        {text}
      </span>
    </button>
  )
}
