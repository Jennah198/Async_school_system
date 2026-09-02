'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { EthiopianDateInput } from '@/components/ui/ethiopian-date-input'
import type { AudienceChoices, AudienceRecordType } from '@/lib/odoo/models/operations'
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementFormState,
} from './actions'

interface Option {
  value: string
  label: string
}

const INPUT =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none'

/** Audience types whose value is a set of records rather than a code. */
const RECORD_AUDIENCES: Record<AudienceRecordType, string> = {
  teacher_group: 'Teachers',
  subject_group: 'Subjects',
  class_section: 'Classes / sections',
  branch_campus: 'Branches / campuses',
  selected_staff: 'Staff',
}

function isRecordAudience(value: string): value is AudienceRecordType {
  return value in RECORD_AUDIENCES
}

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

      {hint ? <p className="mt-1 text-[11px] text-stone">{hint}</p> : null}

      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface AnnouncementDefaults {
  id: number
  name: string
  message: string
  category: string
  priority: string
  audience_type: string
  audience_code: string
  audience_ids: string[]
  publish_date: string
  publish_time: string
  expiry_date: string
  expiry_time: string
  link: string
}

export function AnnouncementForm({
  mode = 'create',
  announcement,
  audienceLocked = false,
  categories,
  priorities,
  audienceTypes,
  departments,
  responsibilities,
  audiences,
}: {
  mode?: 'create' | 'edit'
  announcement?: AnnouncementDefaults
  /**
   * True once the announcement is published. `action_publish` resolved the
   * audience into recipient_user_ids and the record rules read that stored
   * set, so editing the audience now would change nothing anyone can see.
   */
  audienceLocked?: boolean
  categories: Option[]
  priorities: Option[]
  audienceTypes: Option[]
  departments: Option[]
  responsibilities: Option[]
  audiences: AudienceChoices
}) {
  const [state, formAction, pending] = useActionState<AnnouncementFormState, FormData>(
    mode === 'create' ? createAnnouncementAction : updateAnnouncementAction,
    {},
  )

  // What was typed wins over what is stored, so a refused submit keeps the edit.
  const stored = announcement
  const values: Record<string, string> = {
    name: state.values?.name ?? stored?.name ?? '',
    message: state.values?.message ?? stored?.message ?? '',
    category: state.values?.category ?? stored?.category ?? 'general',
    priority: state.values?.priority ?? stored?.priority ?? '0',
    audience_type: state.values?.audience_type ?? stored?.audience_type ?? 'all_staff',
    publish_date: state.values?.publish_date ?? stored?.publish_date ?? '',
    publish_time: state.values?.publish_time ?? stored?.publish_time ?? '',
    expiry_date: state.values?.expiry_date ?? stored?.expiry_date ?? '',
    expiry_time: state.values?.expiry_time ?? stored?.expiry_time ?? '',
    link: state.values?.link ?? stored?.link ?? '',
  }
  const errors = state.fieldErrors ?? {}
  const [audienceType, setAudienceType] = useState(values.audience_type)

  const codeOptions =
    audienceType === 'department'
      ? departments
      : audienceType === 'responsibility'
        ? responsibilities
        : null

  const records = isRecordAudience(audienceType) ? audiences[audienceType] : null

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {stored ? <input type="hidden" name="id" value={stored.id} /> : null}
      <section className="space-y-4">
        <Field label="Title" htmlFor="name" required error={errors.name}>
          <input id="name" name="name" className={INPUT} defaultValue={values.name} />
        </Field>

        <Field label="Message" htmlFor="message" required error={errors.message}>
          <textarea
            id="message"
            name="message"
            rows={5}
            className={INPUT}
            defaultValue={values.message}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="category" required error={errors.category}>
            <select
              id="category"
              name="category"
              className={INPUT}
              defaultValue={values.category}
            >
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority" htmlFor="priority">
            <select
              id="priority"
              name="priority"
              className={INPUT}
              defaultValue={values.priority}
            >
              {priorities.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      <section className="space-y-4 border-t border-silver pt-5">
        <div>
          <h2 className="text-[15px] leading-tight">Audience</h2>
          <p className="mt-0.5 text-[12px] text-slate">
            {audienceLocked
              ? 'Fixed at publication. Odoo resolved the recipients then and the record rules read that stored set, so changing this now would reach nobody new.'
              : 'Odoo resolves this into recipients when the announcement is published.'}
          </p>
        </div>

        {audienceLocked ? (
          <p className="rounded-[8px] border border-silver bg-paper px-3 py-2.5 text-[13px] text-slate">
            {audienceTypes.find((option) => option.value === values.audience_type)?.label ??
              values.audience_type}
          </p>
        ) : (
          <>
        <Field label="Send to" htmlFor="audience_type" required error={errors.audience_type}>
          <select
            id="audience_type"
            name="audience_type"
            className={INPUT}
            value={audienceType}
            onChange={(event) => setAudienceType(event.target.value)}
          >
            {audienceTypes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {codeOptions ? (
          <Field label="Which one" htmlFor="audience_code" required error={errors.audience_value}>
            <select
              id="audience_code"
              name="audience_code"
              className={INPUT}
              defaultValue={stored?.audience_code ?? ''}
            >
              <option value="">Choose…</option>
              {codeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {records ? (
          <Field
            label={RECORD_AUDIENCES[audienceType as AudienceRecordType]}
            htmlFor="audience_ids"
            required
            error={errors.audience_value}
            hint={
              records.length === 0
                ? 'Your role cannot read these records, so this audience is not available to you.'
                : 'Hold Ctrl or Cmd to choose more than one.'
            }
          >
            <select
              id="audience_ids"
              name="audience_ids"
              multiple
              size={Math.min(8, Math.max(4, records.length))}
              className={INPUT}
              disabled={records.length === 0}
              defaultValue={stored?.audience_ids ?? []}
            >
              {records.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
          </>
        )}
      </section>

      <section className="space-y-4 border-t border-silver pt-5">
        <div>
          <h2 className="text-[15px] leading-tight">Visibility window</h2>
          <p className="mt-0.5 text-[12px] text-slate">
            Optional. Leave the expiry empty for an announcement that does not lapse.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Publish on" htmlFor="publish_date" error={errors.publish_date}>
            <EthiopianDateInput
              id="publish_date"
              name="publish_date"
              defaultValue={values.publish_date}
            />
          </Field>

          <Field label="Publish at" htmlFor="publish_time">
            <input
              id="publish_time"
              name="publish_time"
              type="time"
              className={INPUT}
              defaultValue={values.publish_time}
            />
          </Field>

          <Field label="Expires on" htmlFor="expiry_date" error={errors.expiry_date}>
            <EthiopianDateInput
              id="expiry_date"
              name="expiry_date"
              defaultValue={values.expiry_date}
            />
          </Field>

          <Field label="Expires at" htmlFor="expiry_time">
            <input
              id="expiry_time"
              name="expiry_time"
              type="time"
              className={INPUT}
              defaultValue={values.expiry_time}
            />
          </Field>
        </div>

        <Field label="Link" htmlFor="link" hint="Optional URL for further detail.">
          <input
            id="link"
            name="link"
            type="url"
            className={INPUT}
            defaultValue={values.link}
            placeholder="https://"
          />
        </Field>
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
          {pending ? 'Creating…' : 'Save as draft'}
        </button>

        <Link
          href="/announcements"
          className="rounded-[9999px] border border-silver px-5 py-2.5 text-[13px] hover:bg-paper"
        >
          Cancel
        </Link>
      </div>

      <p className="text-[11px] text-stone">
        Announcements are created in draft. Publishing is a separate step on the announcement itself.
      </p>
    </form>
  )
}
