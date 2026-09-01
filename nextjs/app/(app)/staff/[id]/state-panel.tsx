'use client'

import { useActionState, useState } from 'react'
import { staffTransitionAction, type FormState } from '../actions'

/**
 * The staff state machine, driven entirely by Odoo's own transition methods.
 *
 *   Draft ──action_activate──▶ Active ──action_suspend──▶ Suspended
 *                                 └────action_deactivate──▶ Inactive
 *   any ───action_reset_draft──▶ Draft
 *
 * `action_activate` mints the STF- sequence, creates the hr.employee and
 * reactivates linked teacher profiles. None of that is reproduced here — the
 * button calls the method and renders whatever Odoo then reports.
 */

interface Transition {
  key: string
  label: string
  from: string[]
  confirm?: string
  destructive?: boolean
}

const TRANSITIONS: Transition[] = [
  { key: 'activate', label: 'Activate', from: ['draft', 'suspended', 'inactive'] },
  {
    key: 'suspend',
    label: 'Suspend',
    from: ['active'],
    confirm: 'Suspend this staff member? They will not be able to take new teaching assignments.',
  },
  {
    key: 'deactivate',
    label: 'Deactivate',
    from: ['active', 'suspended'],
    confirm:
      'Deactivate this staff member? Their linked Odoo login will be archived so access cannot outlive employment.',
    destructive: true,
  },
  {
    key: 'reset',
    label: 'Return to draft',
    from: ['active', 'suspended', 'inactive'],
    confirm: 'Return this record to Draft? Linked teacher profiles will be set inactive.',
  },
]

export function StaffStatePanel({
  id,
  state,
  missing,
  canWrite,
}: {
  id: number
  state: string
  missing: string
  canWrite: boolean
}) {
  const [result, formAction, pending] = useActionState<FormState, FormData>(
    staffTransitionAction,
    {},
  )
  const [confirming, setConfirming] = useState<Transition | null>(null)

  const available = TRANSITIONS.filter((t) => t.from.includes(state))

  if (!canWrite) {
    return (
      <p className="text-[12px] text-slate">
        Your role can view this record but not change its status.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {state === 'draft' && missing ? (
        <div className="rounded-[8px] bg-paper px-3 py-2.5">
          <p className="text-[12px] font-medium text-graphite">Still required to activate</p>
          {/* Odoo computes this list; it is displayed rather than re-derived. */}
          <p className="mt-1 text-[12px] text-slate">{missing}</p>
        </div>
      ) : null}

      {result.error ? (
        <p role="alert" className="rounded-[8px] bg-danger-bg px-3 py-2 text-[12px] text-danger">
          {result.error}
        </p>
      ) : null}
      {result.ok ? (
        <p role="status" className="rounded-[8px] bg-info-bg px-3 py-2 text-[12px] text-action-blue">
          Status updated.
        </p>
      ) : null}

      {available.length === 0 ? (
        <p className="text-[12px] text-slate">No status changes available from here.</p>
      ) : null}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        {available.map((transition) =>
          confirming?.key === transition.key ? (
            <div key={transition.key} className="rounded-[8px] border border-silver p-3">
              <p className="mb-2.5 text-[12px] text-graphite">{transition.confirm}</p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="transition"
                  value={transition.key}
                  disabled={pending}
                  className={
                    transition.destructive
                      ? 'rounded-[9999px] border border-danger/30 px-3.5 py-1.5 text-[12px] font-medium text-danger hover:bg-danger-bg disabled:opacity-50'
                      : 'rounded-[9999px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-graphite disabled:opacity-50'
                  }
                >
                  {pending ? 'Working…' : `Yes, ${transition.label.toLowerCase()}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(null)}
                  className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : transition.confirm ? (
            <button
              key={transition.key}
              type="button"
              onClick={() => setConfirming(transition)}
              className="w-full rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              {transition.label}
            </button>
          ) : (
            <button
              key={transition.key}
              type="submit"
              name="transition"
              value={transition.key}
              disabled={pending}
              className="w-full rounded-[9999px] bg-ink px-4 py-2 text-[13px] font-medium text-white hover:bg-graphite disabled:opacity-50"
            >
              {pending ? 'Working…' : transition.label}
            </button>
          ),
        )}
      </form>
    </div>
  )
}
