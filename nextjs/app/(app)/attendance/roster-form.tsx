'use client'

import { useActionState } from 'react'
import { generateRosterAction, type AttendanceState } from './actions'

/**
 * Take attendance for a class and date.
 *
 * Generating the roster is an Odoo wizard call, not a loop of creates: it
 * decides who is attendable on that date from the effective placements, and
 * skips anyone already recorded.
 */
export function RosterForm({
  classes,
  defaultDate,
}: {
  /** The same `{value,label}` options the class filter uses. */
  classes: Array<{ value: string; label: string }>
  defaultDate: string
}) {
  const [state, formAction, pending] = useActionState<AttendanceState, FormData>(
    generateRosterAction,
    {},
  )

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div>
        <label htmlFor="classId" className="mb-1.5 block text-[12px] font-medium text-graphite">
          Class
        </label>
        <select
          id="classId"
          name="classId"
          className="rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
        >
          <option value="">Choose…</option>
          {classes.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="date" className="mb-1.5 block text-[12px] font-medium text-graphite">
          Date
        </label>
        <input
          id="date"
          name="date"
          type="date"
          defaultValue={defaultDate}
          className="rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
        />
      </div>
      <button
        id="generate-roster"
        type="submit"
        disabled={pending}
        className="rounded-[9999px] bg-ink px-5 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
      >
        {pending ? 'Generating…' : 'Take attendance'}
      </button>
      {state.error ? (
        <p role="alert" className="basis-full text-[12px] text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="basis-full text-[12px] text-action-blue">
          {state.ok}
        </p>
      ) : null}
    </form>
  )
}

/** One attendance row; the status select saves on change. */
