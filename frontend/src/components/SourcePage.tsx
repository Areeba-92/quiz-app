interface Props {
  page: number | null | undefined
  className?: string
}

/** Where in the study PDF a generated question came from, so it can be checked there. */
export function SourcePage({ page, className = 'inline-block' }: Props) {
  if (!page) return null
  return (
    <span
      className={`${className} shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-400`}
      title={`Written from page ${page} of the study PDF`}
    >
      Page {page}
    </span>
  )
}
