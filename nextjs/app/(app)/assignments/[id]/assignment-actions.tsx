'use client'

import { useActionState, useState } from 'react'
import { Button, cx } from '@/components/ui'
import { assignmentTransitionAction, type AssignmentFormState } from '../actions'

export interface AssignmentTransition {
  key: string
  label: string
  confirm?: string
  destructive?: boolean
}

/**
 * State changes for an assignment.
 *
 * The shape mirrors the workflow panel used elsewhere, but the mechanism
 * differs because `school.teacher.assignment` has no `action_*` methods: the
 * state is a field. What is preserved is the security property — the browser
 * posts a transition key and a record id, and a server-side table decides what
 * that means. It cannot name a field or a value.
 */
export function AssignmentActions({
  assignmentId,
  transitions,
  canWrite,
}: {
  assignmentId: number
  transitions: AssignmentTransition[]
  canWrite: boolean
}) {
  const [state, formAction, pending] = useActionState<AssignmentFormState, FormData>(
    assignmentTransitionAction,
    {},
  )
  const [confirming, setConfirming] = useState<AssignmentTransition | null>(null)

  if (!canWrite) {
    return (
      <p className="text-[12px] text-slate">
        Your role can view this assignment but not change it.
      </p>
    )
  }

  return (
    <div className="space-y-3">
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

      {transitions.length === 0 ? (
        <p className="text-[12px] text-slate">No status changes are available from here.</p>
      ) : null}

      <form action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={assignmentId} />
        {transitions.map((transition) =>
          confirming?.key === transition.key ? (
            <div key={transition.key} className="rounded-[8px] border border-silver p-3">
              <p className="mb-2.5 text-[12px] text-graphite">{transition.confirm}</p>
              <div className="flex gap-2">
                <button
                  type="submit"
                  name="transition"
                  value={transition.key}
                  disabled={pending}
                  className={cx(
                    'rounded-[9999px] px-3.5 py-1.5 text-[12px] font-medium disabled:opacity-50',
                    transition.destructive
                      ? 'border border-danger/30 text-danger hover:bg-danger-bg'
                      : 'bg-ink text-white hover:bg-graphite',
                  )}
                >
                  {pending ? 'Working…' : `Confirm ${transition.label.toLowerCase()}`}
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
          ) : (
            <Button
              key={transition.key}
              type="button"
              variant={transition.destructive ? 'danger' : 'ghost'}
              size="sm"
              onClick={() => setConfirming(transition)}
              className="w-full"
            >
              {transition.label}
            </Button>
          ),
        )}
      </form>
    </div>
  )
}
