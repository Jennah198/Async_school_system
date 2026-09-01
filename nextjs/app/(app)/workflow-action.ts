'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { callAction, write } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getWorkflow } from '@/lib/odoo/workflows'

/**
 * The single entry point for every business transition in the application.
 *
 * The client posts a workflow key, a record id and — where Odoo asks for one —
 * a reason. It never posts a model or a method name: those come from the
 * server-side allowlist in lib/odoo/workflows.ts. An unknown key is refused
 * before anything reaches Odoo.
 *
 * The call runs as the signed-in user's Odoo session, so the ACL, the record
 * rule and every constraint on the transition apply unchanged.
 */

export interface WorkflowState {
  error?: string
  ok?: string
}

export async function runWorkflowAction(
  _previous: WorkflowState,
  form: FormData,
): Promise<WorkflowState> {
  await requireSession()

  const workflowKey = String(form.get('workflow') ?? '')
  const transitionKey = String(form.get('transition') ?? '')
  const id = Number(form.get('id'))
  const reason = String(form.get('reason') ?? '').trim()
  const revalidate = String(form.get('revalidate') ?? '')

  const spec = getWorkflow(workflowKey)
  const transition = spec?.transitions.find((t) => t.key === transitionKey)

  if (!spec || !transition || !Number.isFinite(id) || id <= 0) {
    return { error: 'That action is not available.' }
  }

  if (transition.requiresReason && !reason) {
    return { error: 'A reason is required for this action.' }
  }

  try {
    if (transition.reasonWriteField) {
      // Odoo reads the reason off the record, not off the call — e.g.
      // school.document.action_reject() raises unless rejection_reason is set.
      await write(spec.model, [id], { [transition.reasonWriteField]: reason })
      await callAction(spec.model, transition.method, [id])
    } else if (transition.requiresReason && !transition.reasonContextKey) {
      // Odoo takes the reason positionally, e.g. action_return(reason).
      await callAction(spec.model, transition.method, [id], undefined, [reason])
    } else if (transition.reasonContextKey && reason) {
      // Recorded on Odoo's own audit trail rather than passed as an argument.
      await callAction(spec.model, transition.method, [id], {
        [transition.reasonContextKey]: reason,
      })
    } else {
      await callAction(spec.model, transition.method, [id])
    }
  } catch (cause) {
    // Odoo's ValidationError text is written for the person doing the work —
    // "Only draft enrollments can be activated", "Cannot submit: …". Keep it.
    return { error: toOdooError(cause).message }
  }

  // Revalidate the detail page and its list. Both paths are supplied by the
  // server component that rendered the panel, never by the browser.
  if (revalidate) {
    for (const path of revalidate.split(',').filter(Boolean)) {
      revalidatePath(path)
    }
  }

  return { ok: `${transition.label} completed.` }
}
