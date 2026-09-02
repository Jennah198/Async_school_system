'use client'

import { useActionState, useState } from 'react'
import { Button, cx } from '@/components/ui'
import type { FilterOption } from '@/components/list-toolbar'
import { generateReportCardsAction, type GenerateState } from './actions'

/**
 * The only way a report card comes into existence.
 *
 * `school.report.card` has no create form in Odoo either — generation reads a
 * term's published marks and mints a versioned card per student. Doing it for
 * a whole class is the normal case; the single-student mode exists for a
 * correction, which is why the reason box appears only there.
 */
export function GenerateReportCards({
  classes,
  students,
  terms,
}: {
  classes: FilterOption[]
  students: FilterOption[]
  terms: FilterOption[]
}) {
  const [state, formAction, pending] = useActionState<GenerateState, FormData>(
    generateReportCardsAction,
    {},
  )
  const [mode, setMode] = useState<'class' | 'student'>('class')

  const field =
    'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] ' +
    'focus:border-action-blue focus:outline-none'

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="mode" value={mode} />

      <fieldset className="flex gap-1 rounded-[9999px] bg-paper p-1">
        <legend className="sr-only">What to generate</legend>
        {(
          [
            ['class', 'A whole class'],
            ['student', 'One student'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cx(
              'flex-1 rounded-[9999px] px-3 py-1.5 text-[12px] font-medium transition-colors',
              mode === value ? 'bg-white text-graphite shadow-[var(--shadow-card)]' : 'text-slate',
            )}
          >
            {label}
          </button>
        ))}
      </fieldset>

      <label className="block">
        <span className="mb-1.5 block text-[12px] font-medium text-graphite">Term</span>
        <select name="termId" required className={field}>
          <option value="">Choose…</option>
          {terms.map((term) => (
            <option key={term.value} value={term.value}>
              {term.label}
            </option>
          ))}
        </select>
      </label>

      {mode === 'class' ? (
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-graphite">Class</span>
          <select name="classId" required className={field}>
            <option value="">Choose…</option>
            {classes.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-graphite">Student</span>
            <select name="studentId" required className={field}>
              <option value="">Choose…</option>
              {students.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] font-medium text-graphite">
              Correction reason
            </span>
            <textarea
              name="correctionReason"
              rows={2}
              placeholder="Required when regenerating a card that already exists"
              className={field}
            />
          </label>
        </>
      )}

      <Button type="submit" pending={pending} icon="reportCards" className="w-full">
        {pending ? 'Generating…' : 'Generate'}
      </Button>

      {state.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[12px] text-danger">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="rounded-[8px] bg-info-bg px-3 py-2 text-[12px] text-action-blue">
          {state.ok}
        </p>
      ) : null}
    </form>
  )
}
