'use client'

import { useActionState, useState } from 'react'
import { unlockAssessmentAction, type UnlockState } from '../actions'

/**
 * Reopen a locked assessment.
 *
 * Deliberately two steps: an approved or published result is not something to
 * reopen with one stray click, and Odoo records the reason on the audit trail
 * either way.
 */
export function UnlockForm({ assessmentId }: { assessmentId: number }) {
  const [state, formAction, pending] = useActionState<UnlockState, FormData>(
    unlockAssessmentAction,
    {},
  )
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!open) {
    return (
      <div className="rounded-[8px] border border-silver p-3">
        <p className="mb-2.5 text-[12px] text-graphite">
          Correcting a mark after approval needs the assessment reopened. Odoo records who did it
          and why.
        </p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] font-medium hover:bg-paper"
        >
          Reopen for correction
        </button>
      </div>
    )
  }

  return (
    <form action={formAction} className="rounded-[8px] border border-silver p-3">
      <input type="hidden" name="assessmentId" value={assessmentId} />

      <label className="mb-2.5 block">
        <span className="mb-1 block text-[11px] font-medium text-graphite">
          Reason <span className="text-danger">*</span>
        </span>
        <textarea
          name="reason"
          rows={2}
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Recorded on the Odoo audit trail"
          className="w-full rounded-[8px] border border-silver px-2.5 py-1.5 text-[12px] focus:border-action-blue focus:outline-none"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending || !reason.trim()}
          className="rounded-[9999px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-graphite disabled:opacity-50"
        >
          {pending ? 'Working…' : 'Confirm reopen'}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
          className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper"
        >
          Cancel
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="mt-2 text-[11px] text-danger">
          {state.error}
        </p>
      ) : null}
    </form>
  )
}
