'use client'

import type { ReactNode, SelectHTMLAttributes, InputHTMLAttributes } from 'react'
import { Icon } from '@/components/icons'
import { cx } from './primitives'

/*
  Form primitives.

  Extracted from the staff registration form, which was the only form in the
  application when it was written. Four more forms in this domain need the same
  label/hint/error arrangement, and a second copy would be the point at which
  they start to drift.

  The rule these encode: a field shows Odoo's own error when there is one, its
  hint otherwise, and never both — an error the user has to read past a hint to
  find is an error they will miss.
*/

export const INPUT_CLASS =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none ' +
  'disabled:bg-paper disabled:text-stone'

export const INPUT_INVALID = 'border-danger focus:border-danger'

export function Field({
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
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1.5 block text-[12px] font-medium text-graphite">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden>
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
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

/** A labelled text input wired to the shared error styling. */
export function TextField({
  label,
  name,
  error,
  hint,
  required,
  ...rest
}: {
  label: string
  name: string
  error?: string
  hint?: string
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cx(INPUT_CLASS, error && INPUT_INVALID)}
        {...rest}
      />
    </Field>
  )
}

export interface Option {
  value: string
  label: string
}

export function SelectField({
  label,
  name,
  options,
  error,
  hint,
  required,
  placeholder = 'Choose…',
  ...rest
}: {
  label: string
  name: string
  options: Option[]
  error?: string
  hint?: string
  placeholder?: string
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} htmlFor={name} error={error} hint={hint} required={required}>
      <select
        id={name}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className={cx(INPUT_CLASS, error && INPUT_INVALID)}
        {...rest}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

/** A titled group of fields, laid out two-up and single-column on a phone. */
export function FormSection({
  title,
  hint,
  children,
  columns = 2,
}: {
  title: string
  hint?: string
  children: ReactNode
  columns?: 1 | 2 | 3
}) {
  return (
    <section className="border-t border-silver pt-5 first:border-0 first:pt-0">
      <h2 className="text-[15px] leading-tight">{title}</h2>
      {hint ? <p className="mt-0.5 mb-3 text-[12px] text-slate">{hint}</p> : <div className="mb-3" />}
      <div
        className={cx(
          'grid gap-4',
          columns === 1 && 'sm:grid-cols-1',
          columns === 2 && 'sm:grid-cols-2',
          columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        )}
      >
        {children}
      </div>
    </section>
  )
}

/**
 * The banner for an error Odoo returned about the record as a whole — a
 * duplicate Fayda ID, a failed constraint, a refused transition. Field-level
 * problems belong on the field.
 */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-[8px] bg-danger-bg px-3.5 py-3 text-[13px] text-danger"
    >
      <Icon name="alert" size={16} className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

export function FormSuccess({ children }: { children: ReactNode }) {
  if (!children) return null
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-[8px] bg-info-bg px-3.5 py-3 text-[13px] text-action-blue"
    >
      <Icon name="check" size={16} className="mt-px shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  )
}

/**
 * A read-only value inside a form.
 *
 * Used for what Odoo computes or reserves — the staff number from its
 * sequence, the composed display name. Showing them greyed makes it clear
 * they exist and are not the user's to set, which is better than hiding them
 * and better than offering an input Odoo would ignore.
 */
export function ReadOnlyField({
  label,
  value,
  hint,
}: {
  label: string
  value: ReactNode
  hint?: string
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12px] font-medium text-graphite">{label}</p>
      <p className="rounded-[8px] border border-silver/70 bg-paper px-3 py-2 text-[13px] text-slate">
        {value || '—'}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-stone">{hint}</p> : null}
    </div>
  )
}

/** The action row every form ends with. */
export function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-silver pt-5">{children}</div>
  )
}
