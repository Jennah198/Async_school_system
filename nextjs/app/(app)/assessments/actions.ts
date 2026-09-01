'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { saveMark } from '@/lib/odoo/models/assessment'

export interface MarkState {
  error?: string
  ok?: string
}

/**
 * Record one score.
 *
 * Odoo owns every rule here: it refuses the write once the assessment leaves
 * `open`, rejects any attempt to change the row's scope, promotes a pending
 * row to `recorded` when a score first arrives, and writes a
 * `mark_correction` audit event carrying the reason. None of that is repeated
 * in this function — it validates shape, then hands over.
 */
export async function saveMarkAction(_previous: MarkState, form: FormData): Promise<MarkState> {
  await requireSession()

  const markId = Number(form.get('markId'))
  const assessmentId = Number(form.get('assessmentId'))
  const rawScore = String(form.get('score') ?? '').trim()
  const status = String(form.get('mark_status') ?? '').trim()
  const note = String(form.get('note') ?? '').trim()
  const reason = String(form.get('reason') ?? '').trim()

  if (!Number.isFinite(markId) || markId <= 0) return { error: 'That mark row is not available.' }

  const values: { score?: number; mark_status?: string; note?: string } = {}

  if (rawScore !== '') {
    const score = Number(rawScore)
    if (!Number.isFinite(score) || score < 0) {
      return { error: 'Enter a score of zero or more.' }
    }
    values.score = score
  }
  if (status) values.mark_status = status
  values.note = note

  try {
    await saveMark(markId, values, reason || undefined)
  } catch (cause) {
    // "Score cannot be greater than Out Of", "Marks can only be edited while
    // their assessment is open" — Odoo's wording, kept.
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/assessments/${assessmentId}`)
  return { ok: 'Saved.' }
}
