'use client'

import { useActionState } from 'react'
import { createEnrollmentAction, type EnrollmentFormState } from '../actions'
import { StudentPicker } from './student-picker'

interface Option {
  value: string
  label: string
}

const INPUT =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none'

function Field({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string
  htmlFor: string
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
      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function EnrollmentForm({
  classes,
  admissionTypes,
}: {
  classes: Option[]
  admissionTypes: Option[]
}) {
  const [state, formAction, pending] = useActionState<EnrollmentFormState, FormData>(
    createEnrollmentAction,
    {},
  )
  const err = state.fieldErrors ?? {}
  const prior = state.values ?? {}

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <section>
        <h2 className="text-[15px] leading-tight">Student</h2>
        <p className="mt-0.5 mb-3 text-[12px] text-slate">
          Search for the student&rsquo;s existing record. Only approved students appear.
        </p>
        <StudentPicker name="student_id" error={err.student_id} />
      </section>

      <section className="border-t border-silver pt-5">
        <h2 className="text-[15px] leading-tight">Enrolment</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <Field label="Grade / class" htmlFor="class_id" required error={err.class_id}>
            <select id="class_id" name="class_id" className={INPUT} defaultValue={prior.class_id ?? ''}>
              <option value="">Choose…</option>
              {classes.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Admission type" htmlFor="admission_type" required error={err.admission_type}>
            <select
              id="admission_type"
              name="admission_type"
              className={INPUT}
              defaultValue={prior.admission_type ?? 'returning'}
            >
              {admissionTypes.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Enrollment date" htmlFor="enrollment_date" required error={err.enrollment_date}>
            <input
              id="enrollment_date"
              name="enrollment_date"
              type="date"
              className={INPUT}
              defaultValue={prior.enrollment_date ?? ''}
            />
          </Field>
        </div>
      </section>

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
          {pending ? 'Creating…' : 'Create enrolment'}
        </button>
        <span className="text-[12px] text-stone">
          Created in Draft — activate it from the enrolment record.
        </span>
      </div>
    </form>
  )
}