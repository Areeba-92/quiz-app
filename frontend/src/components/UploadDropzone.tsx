import { useId, useRef, useState } from 'react'

interface Props {
  label: string
  hint: string
  file: File | null
  onChange: (file: File | null) => void
}

export function UploadDropzone({ label, hint, file, onChange }: Props) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function take(list: FileList | null) {
    const next = list?.[0]
    if (next) onChange(next)
  }

  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          take(event.dataTransfer.files)
        }}
        className={[
          'rounded-2xl border-2 border-dashed p-4 transition-colors',
          dragging
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
            : 'border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900',
        ].join(' ')}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          onChange={(event) => take(event.target.files)}
        />

        {file ? (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm">{file.name}</span>
            <button
              type="button"
              onClick={() => {
                onChange(null)
                if (inputRef.current) inputRef.current.value = ''
              }}
              className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Remove
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500 dark:text-slate-400">{hint}</span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Choose file
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
