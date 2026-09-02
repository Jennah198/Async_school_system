'use client'

import { useActionState, useState } from 'react'
import { saveMarkAction, type MarkState } from '../actions'

/**
 * One row of the mark list.
 *
 * Percentage and grade are Odoo's computed values, shown read-only — the
 * grading scheme is never reimplemented here. Entry is disabled unless the
 * assessment is open, mirroring the guard in `school.mark.write`; Odoo
 * enforces it regardless.
 */
export function MarkRow({
  markId,
  assessmentId,
  student,
  score,
  maxScore,
  percentage,
  grade,
  status,
  note,
  statusOptions,
  editable,
  requiresReason,
}: {
  markId: number
  assessmentId: number
  student: string
  score: number
  maxScore: number
  percentage: number
  grade: string | false
  status: string
  note: string
  statusOptions: Array<{ value: string; label: string }>
  editable: boolean
  /** Once past `open`, Odoo wants a reason on any correction. */
  requiresReason: boolean
}) {
  const [state, formAction, pending] = useActionState<MarkState, FormData>(saveMarkAction, {})
  const [localScore, setLocalScore] = useState(String(score ?? ''))
  const [clientError, setClientError] = useState<string | null>(null)

  const handleFormSubmit = (formData: FormData) => {
    const val = formData.get('score')
    if (val !== null && val !== '') {
      const num = Number(val)
      if (num < 0 || num > maxScore) {
        setClientError(`Score must be between 0 and ${maxScore}`)
        return
      }
    }
    setClientError(null)
    formAction(formData)
  }

  const cell = 'px-4 py-2 align-middle'
  const input =
    'w-20 rounded-[8px] border border-silver px-2 py-1 text-[13px] tabular focus:border-action-blue focus:outline-none disabled:bg-paper disabled:text-stone'

  return (
    <tr className="border-b border-silver/70 last:border-0">
      <td className={`${cell} font-medium text-graphite`}>{student}</td>
      <td className={cell} colSpan={5}>
        <form action={handleFormSubmit} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="markId" value={markId} />
          <input type="hidden" name="assessmentId" value={assessmentId} />

          <label className="sr-only" htmlFor={`score-${markId}`}>
            Score for {student}
          </label>
          <input
            id={`score-${markId}`}
            name="score"
            type="number"
            step="0.01"
            min={0}
            max={maxScore}
            value={localScore}
            onChange={(e) => setLocalScore(e.target.value)}
            disabled={!editable}
            className={input}
          />
          <span className="text-[12px] text-stone">/ {maxScore}</span>

          <label className="sr-only" htmlFor={`status-${markId}`}>
            Status for {student}
          </label>
          <select
            id={`status-${markId}`}
            name="mark_status"
            defaultValue={status}
            disabled={!editable}
            className="rounded-[8px] border border-silver px-2 py-1 text-[12px] focus:border-action-blue focus:outline-none disabled:bg-paper disabled:text-stone"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <span className="tabular w-14 text-right text-[12px] text-slate">
            {percentage ? `${percentage.toFixed(1)}%` : '—'}
          </span>
          <span className="w-8 text-[12px] font-medium text-graphite">{grade || '—'}</span>

          <label className="sr-only" htmlFor={`note-${markId}`}>
            Remark for {student}
          </label>
          <input
            id={`note-${markId}`}
            name="note"
            defaultValue={note}
            disabled={!editable}
            placeholder="Remark"
            className="min-w-[120px] flex-1 rounded-[8px] border border-silver px-2 py-1 text-[12px] focus:border-action-blue focus:outline-none disabled:bg-paper"
          />

          {requiresReason ? (
            <input
              name="reason"
              placeholder="Correction reason"
              className="min-w-[140px] rounded-[8px] border border-silver px-2 py-1 text-[12px] focus:border-action-blue focus:outline-none"
            />
          ) : null}

          {editable ? (
            <button
              type="submit"
              disabled={pending}
              className="rounded-[9999px] border border-silver px-3 py-1 text-[12px] hover:bg-paper disabled:opacity-50"
            >
              {pending ? 'Saving…' : 'Save'}
            </button>
          ) : null}

          {clientError ? (
            <span role="alert" className="text-[11px] text-danger">
              {clientError}
            </span>
          ) : null}
          {state.error && !clientError ? (
            <span role="alert" className="text-[11px] text-danger">
              {state.error}
            </span>
          ) : null}
          {state.ok && !clientError ? (
            <span role="status" className="text-[11px] text-action-blue">
              {state.ok}
            </span>
          ) : null}
        </form>
      </td>
    </tr>
  )
}