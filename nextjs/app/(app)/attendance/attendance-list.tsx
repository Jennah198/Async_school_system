'use client'

import { useActionState } from 'react'
import { Cell, DataTable, DateText, Row } from '@/components/ui'
import { formatSelection, formatText } from '@/lib/format'
import { setAttendanceBatchAction, type BatchState } from './actions'

export interface AttendanceListRow {
  id: number
  date: string
  student: string
  className: string
  attendanceType: string | false
  period: string | false
  status: string
}

/**
 * The attendance register as one form.
 *
 * A class is marked in one pass, so it saves in one pass: the action diffs
 * each row against the status it was rendered with and writes only what moved.
 */
export function AttendanceList({
  rows,
  statuses,
  editable,
}: {
  rows: AttendanceListRow[]
  statuses: Array<{ value: string; label: string }>
  editable: boolean
}) {
  const [state, formAction, pending] = useActionState<BatchState, FormData>(
    setAttendanceBatchAction,
    {},
  )

  return (
    <form action={formAction}>
      <DataTable
        caption="Attendance register"
        columns={[
          { key: 'date', label: 'Date' },
          { key: 'student', label: 'Student' },
          { key: 'class', label: 'Class', hideBelow: 'sm' },
          { key: 'type', label: 'Type', hideBelow: 'lg' },
          { key: 'period', label: 'Period', hideBelow: 'lg' },
          { key: 'status', label: 'Status' },
        ]}
      >
        {rows.map((row) => (
          <Row key={row.id}>
            <Cell strong>
              <DateText value={row.date} />
            </Cell>
            <Cell>{row.student}</Cell>
            <Cell hideBelow="sm">{row.className}</Cell>
            <Cell hideBelow="lg">{formatSelection(row.attendanceType)}</Cell>
            <Cell hideBelow="lg">{formatText(row.period)}</Cell>
            <Cell>
              {/* The rendered status rides along so the action writes only what moved. */}
              <input type="hidden" name="attendanceId" value={row.id} />
              <input type="hidden" name={`was-status-${row.id}`} value={row.status} />
              <label className="sr-only" htmlFor={`status-${row.id}`}>
                Attendance status for {row.student}
              </label>
              <select
                id={`status-${row.id}`}
                name={`status-${row.id}`}
                defaultValue={row.status}
                disabled={!editable}
                className="rounded-[8px] border border-silver px-2 py-1 text-[12px] focus:border-action-blue focus:outline-none disabled:bg-paper disabled:text-stone"
              >
                {statuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Cell>
          </Row>
        ))}
      </DataTable>

      {editable ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-silver px-4 py-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-[9999px] bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save attendance'}
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
