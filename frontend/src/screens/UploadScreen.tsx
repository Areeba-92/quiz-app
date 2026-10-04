import { useId, useState } from 'react'
import { parsePdfs } from '../api'
import { ThemeToggle } from '../components/ThemeToggle'
import { UploadDropzone } from '../components/UploadDropzone'
import { generateQuiz, type GenerateProgress } from '../generate'
import type { Difficulty, ParseResponse } from '../types'

interface Props {
  onReady: (quiz: ParseResponse) => void
}

type Mode = 'parse' | 'generate'
type Status = 'idle' | 'working' | 'failed'

const MAX_QUESTIONS = 50

const fieldClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base dark:border-slate-700 dark:bg-slate-900'

function progressText(progress: GenerateProgress | null): string {
  if (!progress || progress.stage === 'reading') return 'Reading the PDF...'
  if (progress.stage === 'finishing') return 'Checking for duplicates...'
  return `Writing questions: chunk ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
}

export function UploadScreen({ onReady }: Props) {
  const [mode, setMode] = useState<Mode>('parse')
  const [quizFile, setQuizFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [studyFile, setStudyFile] = useState<File | null>(null)
  const [numQuestions, setNumQuestions] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [scenarioBased, setScenarioBased] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<GenerateProgress | null>(null)
  const [error, setError] = useState('')
  const countId = useId()
  const difficultyId = useId()

  const working = status === 'working'
  const ready = mode === 'parse' ? quizFile !== null : studyFile !== null
  const countValid = Number.isInteger(numQuestions) && numQuestions >= 1 && numQuestions <= MAX_QUESTIONS

  async function build() {
    setStatus('working')
    setProgress(null)
    setError('')
    try {
      // Problems are shown on the review screen, which App opens when needed.
      if (mode === 'parse' && quizFile) {
        onReady(await parsePdfs(quizFile, keyFile))
      } else if (mode === 'generate' && studyFile) {
        onReady(
          await generateQuiz(studyFile, { numQuestions, difficulty, scenarioBased }, setProgress),
        )
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setStatus('failed')
    }
  }

  function switchTo(next: Mode) {
    setMode(next)
    setStatus('idle')
    setError('')
  }

  const tabClass = (active: boolean) =>
    [
      'min-h-11 flex-1 rounded-lg px-3 text-sm font-medium',
      active
        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
    ].join(' ')

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle />
      </div>
      {/* The form sits a little lower than the theme switch, so the page does not feel top-heavy. */}
      <h1 className="mt-[8vh] text-2xl font-semibold">Build a quiz</h1>

      <div
        role="group"
        aria-label="How to build the quiz"
        className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900"
      >
        <button
          type="button"
          aria-pressed={mode === 'parse'}
          disabled={working}
          onClick={() => switchTo('parse')}
          className={tabClass(mode === 'parse')}
        >
          Quiz PDF
        </button>
        <button
          type="button"
          aria-pressed={mode === 'generate'}
          disabled={working}
          onClick={() => switchTo('generate')}
          className={tabClass(mode === 'generate')}
        >
          Generate quiz from PDF
        </button>
      </div>

      {mode === 'parse' ? (
        <>
          <p className="mt-4 mb-6 text-slate-600 dark:text-slate-400">
            Upload a question PDF. Add its answer key if you have one.
          </p>
          <div className="grid gap-4">
            <UploadDropzone label="Quiz PDF" hint="Required" file={quizFile} onChange={setQuizFile} />
            <UploadDropzone
              label="Answer key PDF"
              hint="Optional"
              file={keyFile}
              onChange={setKeyFile}
            />
          </div>
        </>
      ) : (
        <>
          <p className="mt-4 mb-6 text-slate-600 dark:text-slate-400">
            Upload notes or a chapter. The AI writes questions from its text only, and every answer
            is marked AI-guessed.
          </p>
          <div className="grid gap-4">
            <UploadDropzone
              label="Study PDF"
              hint="Required"
              file={studyFile}
              onChange={setStudyFile}
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor={countId} className="mb-1 block text-sm font-medium">
                  Questions
                </label>
                <input
                  id={countId}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_QUESTIONS}
                  value={Number.isNaN(numQuestions) ? '' : numQuestions}
                  onChange={(event) => setNumQuestions(event.target.valueAsNumber)}
                  className={fieldClass}
                />
              </div>
              <div>
                <label htmlFor={difficultyId} className="mb-1 block text-sm font-medium">
                  Difficulty
                </label>
                <select
                  id={difficultyId}
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                  className={fieldClass}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            {!countValid && (
              <p className="-mt-2 text-sm text-red-700 dark:text-red-300">
                Choose between 1 and {MAX_QUESTIONS} questions.
              </p>
            )}
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={scenarioBased}
                onChange={(event) => setScenarioBased(event.target.checked)}
                className="h-5 w-5 accent-indigo-600"
              />
              Scenario-based questions
            </label>
          </div>
        </>
      )}

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
        disabled={!ready || working || (mode === 'generate' && !countValid)}
        className="mt-6 min-h-11 w-full rounded-xl bg-indigo-600 px-4 font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
      >
        {mode === 'parse'
          ? working
            ? 'Reading the PDF...'
            : 'Build quiz'
          : working
            ? 'Generating...'
            : 'Generate quiz'}
      </button>
      {working && (
        <p
          role="status"
          className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400"
        >
          {mode === 'parse' ? 'Scanned pages take longer.' : progressText(progress)}
        </p>
      )}
    </main>
  )
}
