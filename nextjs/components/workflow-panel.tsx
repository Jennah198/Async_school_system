'use client'

import { useActionState, useState } from 'react'
import { runWorkflowAction, type WorkflowState } from '@/app/(app)/workflow-action'

/**
 * Renders the Odoo transitions available from a record's current state.
 *
 * It receives an already-filtered list from the server; the browser posts only
 * a workflow key and a transition key, which the server maps to a model and a
 * method through its own allowlist. Nothing here can reach an arbitrary Odoo
 * method, and the buttons on offer are a rendering decision — Odoo re-checks
 * every guard.
 */

export interface PanelTransition {
  key: string
  label: string
  confirm?: string
  destructive?: boolean
  requiresReason?: boolean
}

export function WorkflowPanel({
  workflow,
  id,
  transitions,
  revalidate,
  canWrite,
  blockedNote,
  emptyNote = 'No status changes are available from here.',
}: {
  workflow: string
  id: number
  transitions: PanelTransition[]
  /** Paths to refresh after a successful transition. Server-supplied. */
  revalidate: string[]
  canWrite: boolean
  /** What Odoo says is still missing, when it says anything. */
  blockedNote?: string
  emptyNote?: string
}) {
  const [state, formAction, pending] = useActionState<WorkflowState, FormData>(
    runWorkflowAction,
    {},
  )
  const [confirming, setConfirming] = useState<PanelTransition | null>(null)
  const [reason, setReason] = useState('')

  if (!canWrite) {
    return (
      <p className="text-[12px] text-slate">
        Your role can view this record but not change its status.
      </p>
    )
  }

  const hidden = (
    <>
      <input type="hidden" name="workflow" value={workflow} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="revalidate" value={revalidate.join(',')} />
    </>
  )

  return (
    <div className="space-y-3">
      {blockedNote ? (
        <div className="rounded-[8px] bg-paper px-3 py-2.5">
          <p className="text-[12px] font-medium text-graphite">Still required</p>
          {/* Odoo computes this; it is displayed rather than re-derived. */}
          <p className="mt-1 text-[12px] text-slate">{blockedNote}</p>
        </div>
      ) : null}

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

      {transitions.length === 0 ? <p className="text-[12px] text-slate">{emptyNote}</p> : null}

      <form action={formAction} className="space-y-2">
        {hidden}
        {transitions.map((transition) => {
          const isConfirming = confirming?.key === transition.key
          const needsStep = Boolean(transition.confirm || transition.requiresReason)

          if (isConfirming) {
            return (
              <div key={transition.key} className="rounded-[8px] border border-silver p-3">
                {transition.confirm ? (
                  <p className="mb-2.5 text-[12px] text-graphite">{transition.confirm}</p>
                ) : null}
                {transition.requiresReason ? (
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
                      className="w-full rounded-[8px] border border-silver px-2.5 py-1.5 text-[12px] focus:border-action-blue focus:outline-none"
                      placeholder="Recorded on the Odoo audit trail"
                    />
                  </label>
                ) : null}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    name="transition"
                    value={transition.key}
                    disabled={pending || (transition.requiresReason && !reason.trim())}
                    className={
                      transition.destructive
                        ? 'rounded-[9999px] border border-danger/30 px-3.5 py-1.5 text-[12px] font-medium text-danger hover:bg-danger-bg disabled:opacity-50'
                        : 'rounded-[9999px] bg-ink px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-graphite disabled:opacity-50'
                    }
                  >
                    {pending ? 'Working…' : `Confirm ${transition.label.toLowerCase()}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirming(null)
                      setReason('')
                    }}
                    className="rounded-[9999px] border border-silver px-3.5 py-1.5 text-[12px] hover:bg-paper"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )
          }

          return needsStep ? (
            <button
              key={transition.key}
              type="button"
              onClick={() => setConfirming(transition)}
              className={
                transition.destructive
                  ? 'w-full rounded-[9999px] border border-danger/30 px-4 py-2 text-[13px] text-danger hover:bg-danger-bg'
                  : 'w-full rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper'
              }
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
          )
        })}
      </form>
    </div>
  )
}
