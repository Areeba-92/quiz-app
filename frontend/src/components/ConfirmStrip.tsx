import { useEffect, useRef } from 'react'

interface Props {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * An inline yes/cancel question, used instead of a popup (DESIGN.md: no popups)
 * before anything that throws away the student's work.
 */
export function ConfirmStrip({ message, confirmLabel, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus lands on the safe choice, so a stray Enter never discards anything.
  useEffect(() => cancelRef.current?.focus(), [])

  return (
    <div
      role="group"
      aria-label={message}
      className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/50 dark:bg-amber-500/10"
    >
      <p className="min-w-0 flex-1 basis-56">{message}</p>
      <div className="flex gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 font-medium dark:border-slate-700 dark:bg-slate-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="min-h-11 rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
