interface Props {
  onClick: () => void
}

/** Back to the Upload screen. Every screen after Upload has one, top left. */
export function HomeButton({ onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M8 1.6 1 7.4l.9 1.1L3 7.6V14h4v-4h2v4h4V7.6l1.1.9.9-1.1z" />
      </svg>
      Home
    </button>
  )
}
