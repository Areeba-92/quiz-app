import type { Score } from '../types'

interface Props {
  scoreKeyOnly: Score
  scoreAll: Score
  /** DESIGN.md: the key-backed score is hidden when nothing was AI-guessed. */
  hasAiAnswers: boolean
}

function percent({ correct, total }: Score) {
  return total > 0 ? Math.round((correct / total) * 100) : 0
}

function Tile({ label, score, hint }: { label: string; score: Score; hint?: string }) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">
        {score.correct} <span className="text-slate-400">/</span> {score.total}
      </p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{percent(score)}%</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

export function ScoreSummary({ scoreKeyOnly, scoreAll, hasAiAnswers }: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* Also hidden when nothing came from a key: "0 / 0" tells the student nothing. */}
      {hasAiAnswers && scoreKeyOnly.total > 0 && (
        <Tile
          label="Key-backed"
          score={scoreKeyOnly}
          hint="Only questions answered from the answer key."
        />
      )}
      <Tile label="All questions" score={scoreAll} />
    </div>
  )
}
