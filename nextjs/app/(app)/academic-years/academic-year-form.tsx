'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { EthiopianDateInput } from '@/components/ui/ethiopian-date-input'
import { ethiopianYearOf } from '@/lib/ethiopian-date'
import {
  createAcademicYearAction,
  updateAcademicYearAction,
  type AcademicYearFormState,
} from './actions'

function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-graphite">
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>

      {children}

      {hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1 text-[11px] text-stone">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface AcademicYearFormValues {
  id: number
  date_start: string
  date_end: string
  is_current: boolean
}

export function AcademicYearForm({
  mode = 'create',
  year,
}: {
  mode?: 'create' | 'edit'
  year?: AcademicYearFormValues
} = {}) {
  const [state, formAction, pending] = useActionState<AcademicYearFormState, FormData>(
    mode === 'create' ? createAcademicYearAction : updateAcademicYearAction,
    {},
  )

  // What the user typed wins over the stored value, so a refused submit does
  // not throw the edit away.
  const values = {
    date_start: state.values?.date_start ?? year?.date_start ?? '',
    date_end: state.values?.date_end ?? year?.date_end ?? '',
    is_current: state.values?.is_current ?? (year?.is_current ? 'on' : ''),
  }
  const errors = state.fieldErrors ?? {}
  const [dateStart, setDateStart] = useState(values.date_start)

  // Odoo requires the name to be the Ethiopian year of the start date, so the
  // form derives it and shows what it will be rather than asking for it twice.
  const derivedName = dateStart ? ethiopianYearOf(dateStart) : null

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {year ? <input type="hidden" name="id" value={year.id} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Starts on"
          htmlFor="date_start"
          required
          error={errors.date_start}
          hint="The Ethiopian year of this date names the academic year."
        >
          <EthiopianDateInput
            id="date_start"
            name="date_start"
            defaultValue={values.date_start}
            describedBy="date_start-hint"
            onChange={setDateStart}
          />
        </Field>

        <Field label="Ends on" htmlFor="date_end" required error={errors.date_end}>
          <EthiopianDateInput
            id="date_end"
            name="date_end"
            defaultValue={values.date_end}
          />
        </Field>
      </div>

      <div className="rounded-[8px] border border-silver bg-paper px-3 py-2.5">
        <p className="text-[12px] text-slate">
          {mode === 'edit' ? 'This year will be renamed to' : 'This year will be named'}{' '}
          <span className="font-medium text-graphite">
            {derivedName ?? '—'}
          </span>
          {derivedName ? ', the Ethiopian year the start date falls in.' : '. Choose a start date first.'}
        </p>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          name="is_current"
          defaultChecked={values.is_current === 'on'}
          className="h-4 w-4 rounded border-silver"
        />
        <span className="text-[13px] text-graphite">
          Make this the current year for new classes
        </span>
      </label>

      <p className="-mt-4 text-[11px] text-stone">
        Only one year holds this. Odoo rejects a second one and names the year that already has it.
      </p>

      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-silver pt-5">
        <button
          type="submit"
          disabled={pending}
          className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending
            ? mode === 'create'
              ? 'Creating…'
              : 'Saving…'
            : mode === 'create'
              ? 'Create academic year'
              : 'Save changes'}
        </button>

        <Link
          href={year ? `/academic-years/${year.id}` : '/academic-years'}
          className="rounded-[9999px] border border-silver px-5 py-2.5 text-[13px] hover:bg-paper"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
