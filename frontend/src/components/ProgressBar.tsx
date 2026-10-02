interface Props {
  value: number
  max: number
}

export function ProgressBar({ value, max }: Props) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label="Quiz progress"
    >
      <div
        className="h-full rounded-full bg-indigo-600 transition-[width] duration-200 dark:bg-indigo-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
