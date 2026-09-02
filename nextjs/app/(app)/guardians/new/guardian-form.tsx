'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { addGuardianAction, type GuardianFormState } from '../../students/actions'

interface StudentOption {
  id: number
  name: string
  regno: string | false
}

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
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[12px] font-medium text-graphite"
      >
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </label>

      {children}

      {error ? (
        <p
          id={`${htmlFor}-error`}
          role="alert"
          className="mt-1 text-[11px] text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function GuardianForm({
  students,
  relationships,
}: {
  students: StudentOption[]
  relationships: Option[]
}) {
  const [state, formAction, pending] = useActionState<GuardianFormState, FormData>(
    addGuardianAction,
    {},
  )

  const values = state.values ?? {}
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <section>
        <h2 className="text-[15px] leading-tight">Student</h2>
        <p className="mb-3 mt-0.5 text-[12px] text-slate">
          Choose the student this guardian is related to.
        </p>

        <Field
          label="Student"
          htmlFor="studentId"
          required
          error={errors.studentId}
        >
          <select
            id="studentId"
            name="studentId"
            className={INPUT}
            defaultValue={values.studentId ?? ''}
          >
            <option value="">Choose a student…</option>

            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.name}
                {student.regno ? ` — ${student.regno}` : ''}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="border-t border-silver pt-5">
        <h2 className="text-[15px] leading-tight">Guardian</h2>
        <p className="mb-3 mt-0.5 text-[12px] text-slate">
          Enter the guardian's contact and relationship details.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Guardian name"
            htmlFor="name"
            required
            error={errors.name}
          >
            <input
              id="name"
              name="name"
              className={INPUT}
              defaultValue={values.name ?? ''}
              placeholder="Full name"
            />
          </Field>

          <Field label="Phone" htmlFor="phone" error={errors.phone}>
            <input
              id="phone"
              name="phone"
              className={INPUT}
              defaultValue={values.phone ?? ''}
              placeholder="+251..."
            />
          </Field>

          <Field
            label="Relationship"
            htmlFor="relationship"
            required
            error={errors.relationship}
          >
            <select
              id="relationship"
              name="relationship"
              className={INPUT}
              defaultValue={values.relationship ?? ''}
            >
              <option value="">Choose relationship…</option>

              {relationships.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Occupation"
            htmlFor="occupation"
            error={errors.occupation}
          >
            <input
              id="occupation"
              name="occupation"
              className={INPUT}
              defaultValue={values.occupation ?? ''}
              placeholder="Occupation"
            />
          </Field>
        </div>
      </section>

      <section className="border-t border-silver pt-5">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            name="is_primary"
            defaultChecked={values.is_primary === 'on'}
            className="h-4 w-4 rounded border-silver"
          />

          <span className="text-[13px] text-graphite">
            Make this the student's primary guardian
          </span>
        </label>

        <p className="mt-1 text-[11px] text-stone">
          Odoo prevents multiple primary guardians for the same student.
        </p>
      </section>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[8px] bg-danger-bg px-3 py-2 text-[13px] text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-silver pt-5">
        <button
          id="submit-guardian"
          type="submit"
          disabled={pending}
          className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Add guardian'}
        </button>

        <Link
          href="/guardians"
          className="rounded-[9999px] border border-silver px-5 py-2.5 text-[13px] hover:bg-paper"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}