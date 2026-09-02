'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui'
import { EthiopianDateInput } from '@/components/ui/ethiopian-date-input'
import {
  Field,
  FormActions,
  FormError,
  FormSection,
  ReadOnlyField,
  SelectField,
  TextField,
  type Option,
} from '@/components/ui/form'
import { updateAssessmentAction, type AssessmentFormState } from '../../actions'

export interface AssessmentEditValues {
  id: number
  name: string
  assessment_type: string
  date: string
  max_mark: string
  weight: string
  className: string
  subject: string
  term: string
  markCount: number
}

/**
 * Correcting an assessment.
 *
 * Once the mark list exists, Odoo freezes the setup — type, date, maximum and
 * weight — because every row was generated against it. Rather than render
 * inputs whose write would bounce, the form drops them and says why. The name
 * is never frozen, so a typo stays correctable at any point.
 *
 * Class, subject and term are not editable anywhere: they come from the
 * teacher assignment the assessment was created against.
 */
export function AssessmentEditForm({
  assessment,
  types,
  setupFrozen,
}: {
  assessment: AssessmentEditValues
  types: Option[]
  setupFrozen: boolean
}) {
  const [state, formAction, pending] = useActionState<AssessmentFormState, FormData>(
    updateAssessmentAction,
    {},
  )
  const prior = state.values ?? {}
  const value = (field: keyof AssessmentEditValues) =>
    prior[field] !== undefined ? prior[field] : String(assessment[field] ?? '')
  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={assessment.id} />
      <FormError>{state.error}</FormError>

      <FormSection title="Assessment">
        <TextField
          label="Name"
          name="name"
          required
          defaultValue={value('name')}
          error={errors.name}
        />
        <ReadOnlyField label="Class" value={assessment.className} />
        <ReadOnlyField label="Subject" value={assessment.subject} />
        <ReadOnlyField
          label="Term"
          value={assessment.term}
          hint="Set by the teacher assignment this was created against."
        />
      </FormSection>

      {setupFrozen ? (
        <FormSection title="Setup" columns={1}>
          <div className="space-y-3">
            <p className="text-[12px] text-slate">
              The mark list has been generated, so Odoo has frozen the type, date, maximum mark
              and weight — {assessment.markCount}{' '}
              {assessment.markCount === 1 ? 'row was' : 'rows were'} built against them. The name
              above can still be corrected.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Type" value={assessment.assessment_type || '—'} />
              <ReadOnlyField label="Date" value={assessment.date || '—'} />
              <ReadOnlyField label="Maximum mark" value={assessment.max_mark} />
              <ReadOnlyField label="Weight" value={assessment.weight} />
            </dl>
          </div>
        </FormSection>
      ) : (
        <FormSection
          title="Setup"
          hint="Editable only while the assessment is in draft. Generating the mark list fixes these."
        >
          <SelectField
            label="Type"
            name="assessment_type"
            required
            options={types}
            defaultValue={value('assessment_type')}
            error={errors.assessment_type}
          />
          <Field
            label="Date"
            htmlFor="date"
            required
            error={errors.date}
            hint="Must fall inside the term."
          >
            <EthiopianDateInput id="date" name="date" defaultValue={value('date')} />
          </Field>
          <TextField
            label="Maximum mark"
            name="max_mark"
            type="number"
            min={1}
            step="0.5"
            required
            defaultValue={value('max_mark')}
            error={errors.max_mark}
          />
          <TextField
            label="Weight"
            name="weight"
            type="number"
            min={0.1}
            step="0.1"
            required
            defaultValue={value('weight')}
            error={errors.weight}
            hint="All assessments for this subject and term may not exceed 100 together."
          />
        </FormSection>
      )}

      <FormActions>
        <Button type="submit" pending={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
        <Link
          href={`/assessments/${assessment.id}`}
          className="rounded-[9999px] border border-silver px-5 py-2.5 text-[13px] hover:bg-paper"
        >
          Cancel
        </Link>
      </FormActions>
    </form>
  )
}
