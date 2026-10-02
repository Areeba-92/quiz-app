import { useState } from 'react'
import { parsePdfs } from '../api'
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
  const [parsed, setParsed] = useState<ParseResponse | null>(null)

  async function build() {
    if (!quizFile) return
    setStatus('parsing')
    setError('')
    try {
      const result = await parsePdfs(quizFile, keyFile)
      // Straight into the quiz when the extraction is clean; stop and show the
      // problems when it is not. SOUL.md: never hide a bad extraction.
      if (result.warnings.length === 0) {
        onReady(result)
      } else {
        setParsed(result)
        setStatus('idle')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setStatus('failed')
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Build a quiz</h1>
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

      {parsed && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/50 dark:bg-amber-500/10">
          <p className="font-medium">
            Found {parsed.question_count} questions, with {parsed.warnings.length}{' '}
            {parsed.warnings.length === 1 ? 'problem' : 'problems'}:
          </p>
          <ul className="mt-2 list-disc pl-5">
            {parsed.warnings.slice(0, 6).map((warning, index) => (
              <li key={index}>{warning.message}</li>
            ))}
          </ul>
          {parsed.pages.scanned_pages.length > 0 && (
            <p className="mt-2">Scanned pages take longer and are not read yet.</p>
          )}
          <button
            type="button"
            onClick={() => onReady(parsed)}
            className="mt-3 min-h-11 rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700"
          >
            Start quiz anyway
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={build}
        disabled={!quizFile || status === 'parsing'}
        className="mt-6 min-h-11 w-full rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
      >
        {status === 'parsing' ? 'Reading the PDF...' : 'Build quiz'}
      </button>
    </main>
  )
}
