'use client'

import { useActionState } from 'react'
import {
  assignResponsibilityAction,
  type ResponsibilityState,
} from '../actions'

type Option = { value: string; label: string }

export function AssignResponsibilityForm({
  staffId,
  responsibilities,
  departments,
  defaultDepartment,
}: {
  staffId: number
  responsibilities: Option[]
  departments: Option[]
  defaultDepartment?: string
}) {
  const [state, formAction, pending] = useActionState<ResponsibilityState, FormData>(
    assignResponsibilityAction,
    {},
  )

  return (
    <form action={formAction} className="space-y-4 border-t border-silver pt-4">
      <input type="hidden" name="staffId" value={staffId} />

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Responsibility */}
        <div>
          <label htmlFor="responsibility" className="mb-1.5 block text-[12px] font-medium text-graphite">
            Responsibility
          </label>
          <select
            id="responsibility"
            name="responsibility"
            required
            className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
          >
            <option value="">Choose…</option>
            {responsibilities.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {state.fieldErrors?.responsibility && (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.responsibility}</p>
          )}
        </div>

        {/* Department */}
        <div>
          <label htmlFor="department" className="mb-1.5 block text-[12px] font-medium text-graphite">
            Department
          </label>
          <select
            id="department"
            name="department"
            defaultValue={defaultDepartment ?? ''}
            className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
          >
            <option value="">—</option>
            {departments.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start date */}
        <div>
          <label htmlFor="start_date" className="mb-1.5 block text-[12px] font-medium text-graphite">
            Effective from
          </label>
          <input
            id="start_date"
            name="start_date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
          />
          {state.fieldErrors?.start_date && (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.start_date}</p>
          )}
        </div>

        {/* End date (optional) */}
        <div>
          <label htmlFor="end_date" className="mb-1.5 block text-[12px] font-medium text-graphite">
            Effective to (optional)
          </label>
          <input
            id="end_date"
            name="end_date"
            type="date"
            className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] focus:border-action-blue focus:outline-none"
          />
          {state.fieldErrors?.end_date && (
            <p className="mt-1 text-[12px] text-danger">{state.fieldErrors.end_date}</p>
          )}
        </div>
      </div>

      {/* Primary checkbox */}
      <label className="flex items-center gap-2 text-[13px] text-graphite">
        <input
          type="checkbox"
          name="is_primary"
          value="true"
          className="rounded border-silver"
        />
        Set as primary responsibility
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9999px] bg-ink px-5 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Assigning…' : 'Assign responsibility'}
        </button>

        {state.error && (
          <p role="alert" className="text-[12px] text-danger">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p role="status" className="text-[12px] text-action-blue">
            {state.ok}
          </p>
        )}
      </div>
    </form>
  )
}