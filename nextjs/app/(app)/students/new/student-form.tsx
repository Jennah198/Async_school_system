'use client'

import { useActionState, useState } from 'react'
import { formatSelection } from '@/lib/format'
import { registerStudentAction, type StudentFormState } from '../actions'

interface Option {
  value: string
  label: string
}
interface ClassOption {
  id: number
  name: string
  year: string
  level: string
  entryLevel: boolean
}

const INPUT =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none'

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
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
      {hint && !error ? <p className="mt-1 text-[11px] text-stone">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-silver pt-5 first:border-0 first:pt-0">
      <h2 className="text-[15px] leading-tight">{title}</h2>
      {hint ? <p className="mt-0.5 mb-3 text-[12px] text-slate">{hint}</p> : <div className="mb-3" />}
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

export function StudentRegistrationForm({
  classes,
  genders,
  admissionTypes,
  canSeeFan,
}: {
  classes: ClassOption[]
  genders: Option[]
  admissionTypes: Option[]
  canSeeFan: boolean
}) {
  const [state, formAction, pending] = useActionState<StudentFormState, FormData>(
    registerStudentAction,
    {},
  )
  const prior = state.values ?? {}
  const [classId, setClassId] = useState(prior.class_id ?? '')
  const [admissionType, setAdmissionType] = useState(prior.admission_type ?? 'new')

  const chosen = classes.find((c) => String(c.id) === classId)
  const err = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Section title="Student">
        <Field label="Full name" htmlFor="name" required error={err.name}>
          <input id="name" name="name" className={INPUT} defaultValue={prior.name ?? ''} />
        </Field>
        <Field
          label="Date of birth"
          htmlFor="date_of_birth"
          required
          error={err.date_of_birth}
          hint="Odoo enforces a minimum age for the chosen grade."
        >
          <input
            id="date_of_birth"
            name="date_of_birth"
            type="date"
            className={INPUT}
            defaultValue={prior.date_of_birth ?? ''}
          />
        </Field>
        <Field label="Gender" htmlFor="gender">
          <select id="gender" name="gender" className={INPUT} defaultValue={prior.gender ?? ''}>
            <option value="">Not specified</option>
            {genders.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {canSeeFan ? (
          <Field
            label="FAN (National ID)"
            htmlFor="fan_number"
            error={err.fan_number}
            hint="Exactly 16 digits. Required before the registration can be submitted."
          >
            <input
              id="fan_number"
              name="fan_number"
              inputMode="numeric"
              className={INPUT}
              defaultValue={prior.fan_number ?? ''}
            />
          </Field>
        ) : null}
      </Section>

      <Section
        title="Placement"
        hint="The academic year, section, stream and education level are taken from the class, exactly as Odoo derives them."
      >
        <Field label="Grade / class" htmlFor="class_id" required error={err.class_id}>
          <select
            id="class_id"
            name="class_id"
            className={INPUT}
            value={classId}
            onChange={(event) => setClassId(event.target.value)}
          >
            <option value="">Choose…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.year}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Admission type" htmlFor="admission_type">
          <select
            id="admission_type"
            name="admission_type"
            className={INPUT}
            value={admissionType}
            onChange={(event) => setAdmissionType(event.target.value)}
          >
            {admissionTypes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        {chosen ? (
          <p className="text-[11px] text-stone sm:col-span-2">
            {chosen.name} sits in {chosen.year}
            {chosen.level ? ` · ${formatSelection(chosen.level)}` : ''}
            {chosen.entryLevel
              ? ' · entry level, so no previous-grade document is required'
              : ' · a previous-grade document is required before submission'}
            .
          </p>
        ) : null}
        {admissionType === 'transfer' ? (
          <Field
            label="Previous school"
            htmlFor="previous_school"
            hint="Required by Odoo for a transfer admission."
          >
            <input
              id="previous_school"
              name="previous_school"
              className={INPUT}
              defaultValue={prior.previous_school ?? ''}
            />
          </Field>
        ) : null}
        <Field label="Registration date" htmlFor="registration_date">
          <input
            id="registration_date"
            name="registration_date"
            type="date"
            className={INPUT}
            defaultValue={prior.registration_date ?? ''}
          />
        </Field>
      </Section>

      <Section
        title="Parent / guardian"
        hint="Approving the registration turns this contact into a partner-backed guardian record."
      >
        <Field label="Guardian name" htmlFor="guardian_name" required error={err.guardian_name}>
          <input
            id="guardian_name"
            name="guardian_name"
            className={INPUT}
            defaultValue={prior.guardian_name ?? ''}
          />
        </Field>
        <Field
          label="Guardian phone"
          htmlFor="guardian_phone"
          required
          error={err.guardian_phone}
          hint="Local number, or include + and the country code."
        >
          <input
            id="guardian_phone"
            name="guardian_phone"
            className={INPUT}
            defaultValue={prior.guardian_phone ?? ''}
          />
        </Field>
        <Field
          label="Emergency contact name"
          htmlFor="emergency_contact_name"
          required
          error={err.emergency_contact_name}
        >
          <input
            id="emergency_contact_name"
            name="emergency_contact_name"
            className={INPUT}
            defaultValue={prior.emergency_contact_name ?? ''}
          />
        </Field>
        <Field
          label="Emergency contact phone"
          htmlFor="emergency_contact_phone"
          required
          error={err.emergency_contact_phone}
        >
          <input
            id="emergency_contact_phone"
            name="emergency_contact_phone"
            className={INPUT}
            defaultValue={prior.emergency_contact_phone ?? ''}
          />
        </Field>
      </Section>

      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-silver pt-5">
        <button
          id="submit-student"
          type="submit"
          disabled={pending}
          className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create registration'}
        </button>
        <span className="text-[12px] text-stone">
          Created in Draft — submit and approve from the student record.
        </span>
      </div>
    </form>
  )
}
