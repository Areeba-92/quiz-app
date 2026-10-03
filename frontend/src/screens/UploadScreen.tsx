import { useState } from 'react'
import { parsePdfs } from '../api'
import { ThemeToggle } from '../components/ThemeToggle'
import { UploadDropzone } from '../components/UploadDropzone'
import type { ParseResponse } from '../types'

interface Props {
  onReady: (quiz: ParseResponse) => void
}

type Status = 'idle' | 'parsing' | 'failed'

export function UploadScreen({ onReady }: Props) {
  const [quizFile, setQuizFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function build() {
    if (!quizFile) return
    setStatus('parsing')
    setError('')
    try {
      // Problems are shown on the review screen, which App opens when needed.
      onReady(await parsePdfs(quizFile, keyFile))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setStatus('failed')
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      {/* The form sits a little lower than the theme switch, so the page does not feel top-heavy. */}
      <h1 className="mt-[8vh] text-2xl font-semibold">Build a quiz</h1>
      <p className="mt-1 mb-6 text-slate-600 dark:text-slate-400">
        Upload a question PDF. Add its answer key if you have one.
      </p>

      <div className="grid gap-4">
        <UploadDropzone
          label="Quiz PDF"
          hint="Required"
          file={quizFile}
          onChange={setQuizFile}
        />
        <UploadDropzone
          label="Answer key PDF"
          hint="Optional"
          file={keyFile}
          onChange={setKeyFile}
        />
      </div>

      {status === 'failed' && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-500/50 dark:bg-red-500/10 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={build}
        disabled={!quizFile || status === 'parsing'}
        className="mt-6 min-h-11 w-full rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
      >
        {status === 'parsing' ? 'Reading the PDF...' : 'Build quiz'}
      </button>
      {status === 'parsing' && (
        <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
          Scanned pages take longer.
        </p>
      )}
    </main>
  )
}
