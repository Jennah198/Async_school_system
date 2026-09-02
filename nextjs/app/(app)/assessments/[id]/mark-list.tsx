'use client'

import { useActionState, useState } from 'react'
import { MarkRow } from './mark-row'
import { saveMarksAction, type MarkListState } from '../actions'

export interface MarkListRow {
  id: number
  student: string
  score: number
  maxScore: number
  percentage: number
  grade: string | false
  status: string
  note: string
}

/**
 * The mark list as one form.
 *
 * A roster is entered in one pass, so it saves in one pass: the action diffs
 * each row against the values it was rendered with and writes only what moved.
 * Scores are bounds-checked here before the round trip, and again by Odoo,
 * whose "Score cannot be greater than Out Of" is the authority.
 */
export function MarkList({
  assessmentId,
  rows,
  statusOptions,
  editable,
}: {
  assessmentId: number
  rows: MarkListRow[]
  statusOptions: Array<{ value: string; label: string }>
  editable: boolean
}) {
  const [state, formAction, pending] = useActionState<MarkListState, FormData>(saveMarksAction, {})
  const [clientErrors, setClientErrors] = useState<Record<number, string>>({})

  function handleSubmit(form: FormData) {
    const errors: Record<number, string> = {}

    for (const row of rows) {
      const raw = String(form.get(`score-${row.id}`) ?? '').trim()
      if (raw === '') continue
      const score = Number(raw)
      if (!Number.isFinite(score) || score < 0 || score > row.maxScore) {
        errors[row.id] = `Score must be between 0 and ${row.maxScore}.`
      }
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors)
      return
    }

    setClientErrors({})
    formAction(form)
  }

  const errors = Object.keys(clientErrors).length > 0 ? clientErrors : (state.rowErrors ?? {})

  return (
    <form action={handleSubmit}>
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              {['Student', 'Score', 'Status', 'Percent', 'Grade', 'Remark'].map((label) => (
                <th
                  key={label}
                  className="border-b border-silver px-4 py-2.5 text-left text-[11px] font-medium tracking-wide text-slate uppercase"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <MarkRow
                key={row.id}
                markId={row.id}
                student={row.student}
                score={row.score}
                maxScore={row.maxScore}
                percentage={row.percentage}
                grade={row.grade}
                status={row.status}
                note={row.note}
                statusOptions={statusOptions}
                editable={editable}
                error={errors[row.id]}
              />
            ))}
          </tbody>
        </table>
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-silver px-4 py-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9999px] bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save marks'}
          </button>

          {state.error ? (
            <span role="alert" className="text-[12px] text-danger">
              {state.error}
            </span>
          ) : null}

          {state.ok && !state.error ? (
            <span role="status" className="text-[12px] text-action-blue">
              {state.ok}
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}
