'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { changedRows } from '@/lib/mark-diff'
import { saveMark } from '@/lib/odoo/models/assessment'

export interface MarkListState {
  error?: string
  ok?: string
  /** Odoo's refusal for one row, keyed by mark id. */
  rowErrors?: Record<number, string>
}

/**
 * Save every changed row of a mark list in one pass.
 *
 * Odoo owns every rule here: it refuses the write once the assessment leaves
 * `open`, rejects any attempt to change a row's scope, and promotes a pending
 * row to `recorded` when a score first arrives. This validates shape, then
 * hands over — and reports each refusal against the row it came from rather
 * than failing the whole roster, because one out-of-range score should not
 * discard thirty good ones.
 */
export async function saveMarksAction(
  _previous: MarkListState,
  form: FormData,
): Promise<MarkListState> {
  await requireSession()

  const assessmentId = Number(form.get('assessmentId'))
  const markIds = form
    .getAll('markId')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  if (markIds.length === 0) return { error: 'This mark list has no rows to save.' }

  const rowErrors: Record<number, string> = {}
  const changes = changedRows(form, markIds).filter(({ markId, values }) => {
    const max = Number(form.get(`max-${markId}`))
    if (values.score === undefined) return true
    if (!Number.isFinite(values.score) || values.score < 0) {
      rowErrors[markId] = 'Enter a score of zero or more.'
      return false
    }
    if (Number.isFinite(max) && values.score > max) {
      rowErrors[markId] = `Score cannot be greater than ${max}.`
      return false
    }
    return true
  })

  if (changes.length === 0) {
    return Object.keys(rowErrors).length > 0
      ? { rowErrors, error: 'Nothing saved — fix the rows above.' }
      : { ok: 'No changes to save.' }
  }

  const results = await Promise.allSettled(
    changes.map(({ markId, values }) => saveMark(markId, values)),
  )

  let refused = 0
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      // "Marks can only be edited while their assessment is open" and the like
      // — Odoo's wording, kept, against the row that caused it.
      rowErrors[changes[index].markId] = toOdooError(result.reason).message
      refused += 1
    }
  })

  // Rows rejected before the write are already out of `changes`, so only the
  // refusals from Odoo come off the count.
  const saved = changes.length - refused
  if (Number.isInteger(assessmentId) && assessmentId > 0) {
    revalidatePath(`/assessments/${assessmentId}`)
  }

  if (Object.keys(rowErrors).length > 0) {
    return {
      rowErrors,
      error: saved > 0 ? `Saved ${saved}. The rows above were refused.` : undefined,
    }
  }

  return { ok: `Saved ${saved} ${saved === 1 ? 'mark' : 'marks'}.` }
}
