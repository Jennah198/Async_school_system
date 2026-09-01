'use client'

import { useActionState, useMemo, useState } from 'react'
import { registerStaffAction, type FormState } from '../actions'

interface Option {
  value: string
  label: string
}
interface JobTitle {
  id: number
  name: string
  department: string
  responsibility: string
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

export function StaffRegistrationForm({
  jobTitles,
  departments,
  genders,
  employmentTypes,
  employmentStatuses,
  responsibilities,
  canSeePersonalData,
  canSeeFayda,
}: {
  jobTitles: JobTitle[]
  departments: Option[]
  genders: Option[]
  employmentTypes: Option[]
  employmentStatuses: Option[]
  responsibilities: Option[]
  canSeePersonalData: boolean
  canSeeFayda: boolean
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(registerStaffAction, {})
  // Seeded from whatever the last rejected submit posted, so nothing is lost.
  const prior = state.values ?? {}
  const [department, setDepartment] = useState(prior.department ?? '')
  const [jobTitleId, setJobTitleId] = useState(prior.job_title_id ?? '')
  const [responsibility, setResponsibility] = useState(prior.responsibility ?? '')

  // Odoo's job_title_id domain is [('department','=',department)], and its
  // _check_job_title_department constraint enforces it. Filtering here keeps
  // the user from picking a combination the server would reject.
  const titlesForDepartment = useMemo(
    () => jobTitles.filter((t) => !department || t.department === department),
    [jobTitles, department],
  )

  /*
    Reproduces what _onchange_job_title_id does in the Odoo client: a job title
    carries the responsibility it grants. Onchange never fires over RPC, so the
    value is defaulted here and submitted explicitly — the rule still lives in
    Odoo's data, this only reads it.
  */
  function pickJobTitle(id: string) {
    setJobTitleId(id)
    const granted = jobTitles.find((t) => String(t.id) === id)?.responsibility
    if (granted) setResponsibility(granted)
  }

  const err = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Section title="Personal information">
        <Field label="First name" htmlFor="first_name" required error={err.first_name}>
          <input id="first_name" name="first_name" defaultValue={prior.first_name ?? ''} className={INPUT} autoComplete="off" />
        </Field>
        <Field label="Last name" htmlFor="last_name" required error={err.last_name}>
          <input id="last_name" name="last_name" defaultValue={prior.last_name ?? ''} className={INPUT} autoComplete="off" />
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
        {canSeePersonalData ? (
          <Field
            label="Date of birth"
            htmlFor="date_of_birth"
            hint="Required before the record can leave Draft. Minimum age is 18."
            error={err.date_of_birth}
          >
            <input id="date_of_birth" name="date_of_birth" type="date" defaultValue={prior.date_of_birth ?? ''} className={INPUT} />
          </Field>
        ) : null}
        {canSeeFayda ? (
          <Field
            label="Fayda ID"
            htmlFor="fayda_id"
            hint="Exactly 16 digits. Stored once per person, for life."
            error={err.fayda_id}
          >
            <input id="fayda_id" name="fayda_id" defaultValue={prior.fayda_id ?? ''} inputMode="numeric" className={INPUT} />
          </Field>
        ) : null}
      </Section>

      <Section title="Contact" hint="A phone number is required before activation; two staff cannot share one.">
        <Field label="Primary phone" htmlFor="phone" error={err.phone}>
          <input id="phone" name="phone" defaultValue={prior.phone ?? ''} className={INPUT} placeholder="+251 91 100 0000" />
        </Field>
        <Field label="Mobile" htmlFor="mobile">
          <input id="mobile" name="mobile" defaultValue={prior.mobile ?? ''} className={INPUT} />
        </Field>
        <Field
          label="Email"
          htmlFor="email"
          hint="Becomes the Odoo login if a teacher profile is created later, so it must be unique."
          error={err.email}
        >
          <input id="email" name="email" defaultValue={prior.email ?? ''} type="email" className={INPUT} />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Department" htmlFor="department" required error={err.department}>
          <select
            id="department"
            name="department"
            className={INPUT}
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value)
              setJobTitleId('')
            }}
          >
            <option value="">Choose…</option>
            {departments.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Job title"
          htmlFor="job_title_id"
          required
          error={err.job_title_id}
          hint={department ? undefined : 'Choose a department first.'}
        >
          <select
            id="job_title_id"
            name="job_title_id"
            className={INPUT}
            value={jobTitleId}
            disabled={!department}
            onChange={(e) => pickJobTitle(e.target.value)}
          >
            <option value="">Choose…</option>
            {titlesForDepartment.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Employment type" htmlFor="employment_type">
          <select id="employment_type" name="employment_type" className={INPUT} defaultValue={prior.employment_type ?? ''}>
            <option value="">Not specified</option>
            {employmentTypes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Employment status"
          htmlFor="employment_status"
          required
          error={err.employment_status}
        >
          <select id="employment_status" name="employment_status" className={INPUT} defaultValue={prior.employment_status || 'active'}>
            {employmentStatuses.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hire date" htmlFor="hire_date">
          <input id="hire_date" name="hire_date" type="date" defaultValue={prior.hire_date ?? ''} className={INPUT} />
        </Field>
      </Section>

      <Section
        title="Responsibility"
        hint="At least one active responsibility is required before the record can leave Draft. Choosing a job title suggests the one it grants."
      >
        <Field label="Primary responsibility" htmlFor="responsibility" required error={err.responsibility}>
          <select
            id="responsibility"
            name="responsibility"
            className={INPUT}
            value={responsibility}
            onChange={(e) => setResponsibility(e.target.value)}
          >
            <option value="">Choose…</option>
            {responsibilities.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 border-t border-silver pt-5">
        <button
          id="submit-staff"
          type="submit"
          disabled={pending}
          className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create staff record'}
        </button>
        <span className="text-[12px] text-stone">
          Created in Draft — activate from the staff record once complete.
        </span>
      </div>
    </form>
  )
}
