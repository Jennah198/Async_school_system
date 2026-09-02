'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui'
import { FormError, FormSection, INPUT_CLASS, TextField } from '@/components/ui/form'
import { coverageGap, overlappingBands } from '@/lib/grading-coverage'
import { createSchemeAction, type BandDraft, type GradingFormState } from './actions'

/**
 * The scale the module seeds and the one most schools here already use:
 * contiguous ten-point bands with a 50% pass mark. Starting from it means the
 * common case is a single click, and the coverage rule is satisfied by default.
 */
const DEFAULT_BANDS: BandDraft[] = [
  { name: 'A', minimum: '90', maximum: '100', remark: 'Excellent' },
  { name: 'B', minimum: '80', maximum: '89.99', remark: 'Very Good' },
  { name: 'C', minimum: '70', maximum: '79.99', remark: 'Good' },
  { name: 'D', minimum: '60', maximum: '69.99', remark: 'Satisfactory' },
  { name: 'E', minimum: '50', maximum: '59.99', remark: 'Pass' },
  { name: 'F', minimum: '0', maximum: '49.99', remark: 'Needs Improvement' },
]

const BLANK: BandDraft = { name: '', minimum: '', maximum: '', remark: '' }

/** Only rows with both ends filled can be checked for coverage. */
function measurable(bands: BandDraft[]) {
  return bands
    .filter((band) => band.minimum !== '' && band.maximum !== '')
    .map((band) => ({
      minimum_percentage: Number(band.minimum),
      maximum_percentage: Number(band.maximum),
    }))
    .filter(
      (band) =>
        Number.isFinite(band.minimum_percentage) && Number.isFinite(band.maximum_percentage),
    )
}

export function SchemeCreateForm() {
  const [state, formAction, pending] = useActionState<GradingFormState, FormData>(
    createSchemeAction,
    {},
  )
  const [bands, setBands] = useState<BandDraft[]>(state.bands ?? DEFAULT_BANDS)

  const setBand = (index: number, patch: Partial<BandDraft>) =>
    setBands((current) =>
      current.map((band, position) => (position === index ? { ...band, ...patch } : band)),
    )

  const checkable = measurable(bands)
  const incomplete = checkable.length !== bands.length
  // Odoo applies exactly these two rules when the scheme is put into use.
  const problem = incomplete ? null : (overlappingBands(checkable) ?? coverageGap(checkable))

  const errors = state.fieldErrors ?? {}

  return (
    <form action={formAction} className="space-y-6">
      <FormError>{state.error}</FormError>

      <FormSection title="Scheme">
        <TextField
          label="Name"
          name="name"
          required
          defaultValue={state.values?.name ?? ''}
          error={errors.name}
          placeholder="Standard Grading"
        />
        <TextField
          label="Pass mark"
          name="pass_percentage"
          type="number"
          min={0}
          max={100}
          step="0.01"
          required
          defaultValue={state.values?.pass_percentage ?? '50'}
          error={errors.pass_percentage}
          hint="The percentage at or above which a subject counts as passed."
        />
      </FormSection>

      <FormSection title="Bands" columns={1} hint="Highest first, though the order here does not matter.">
        <div className="space-y-2">
          <div className="hidden gap-2 px-1 text-[11px] text-stone sm:grid sm:grid-cols-[1fr_5rem_5rem_2fr_2.5rem]">
            <span>Grade</span>
            <span>From</span>
            <span>To</span>
            <span>Remark</span>
            <span className="sr-only">Remove</span>
          </div>

          {bands.map((band, index) => (
            // Rows carry no id yet, so position is the only stable key here.
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_2fr_2.5rem]">
              <input
                name="band_name"
                aria-label={`Band ${index + 1} grade`}
                value={band.name}
                onChange={(event) => setBand(index, { name: event.target.value })}
                className={INPUT_CLASS}
                placeholder="A"
              />
              <input
                name="band_min"
                type="number"
                min={0}
                max={100}
                step="0.01"
                aria-label={`Band ${index + 1} lowest percentage`}
                value={band.minimum}
                onChange={(event) => setBand(index, { minimum: event.target.value })}
                className={INPUT_CLASS}
              />
              <input
                name="band_max"
                type="number"
                min={0}
                max={100}
                step="0.01"
                aria-label={`Band ${index + 1} highest percentage`}
                value={band.maximum}
                onChange={(event) => setBand(index, { maximum: event.target.value })}
                className={INPUT_CLASS}
              />
              <input
                name="band_remark"
                aria-label={`Band ${index + 1} remark`}
                value={band.remark}
                onChange={(event) => setBand(index, { remark: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Excellent"
              />
              <button
                type="button"
                onClick={() => setBands((current) => current.filter((_, p) => p !== index))}
                disabled={bands.length === 1}
                aria-label={`Remove band ${index + 1}`}
                className="rounded-[8px] border border-silver px-2 text-[13px] text-slate hover:bg-paper disabled:opacity-40"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setBands((current) => [...current, { ...BLANK }])}
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Add band
            </button>
            <button
              type="button"
              onClick={() => setBands(DEFAULT_BANDS.map((band) => ({ ...band })))}
              className="text-[12px] text-slate underline underline-offset-2 hover:text-graphite"
            >
              Reset to the standard scale
            </button>
          </div>

          <p role="status" className="pt-1 text-[12px] text-stone">
            {incomplete ? (
              'Fill in both ends of every band to check the coverage.'
            ) : problem ? (
              <span className="text-danger">
                {problem} The scheme will save, but Odoo refuses to use it for report cards
                until the bands cover 0 through 100.
              </span>
            ) : (
              'These bands cover 0 through 100.'
            )}
          </p>
        </div>
      </FormSection>

      <div className="flex flex-wrap items-center gap-3 border-t border-silver pt-5">
        <Button type="submit" pending={pending}>
          {pending ? 'Creating…' : 'Create scheme'}
        </Button>
        <span className="text-[12px] text-stone">
          Creating it does not put it into use — that is a separate step on the scheme.
        </span>
      </div>
    </form>
  )
}
