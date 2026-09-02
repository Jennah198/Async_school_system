'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { changedRows } from '@/lib/mark-diff'
import { createAssessment, saveMark, unlockAssessment } from '@/lib/odoo/models/assessment'

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

export interface AssessmentFormState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

/**
 * Create an assessment in draft.
 *
 * Odoo owns the hard rules — the date must fall inside the term, the term must
 * belong to the class's academic year, the assignment must be the exact
 * applicable one, and the assessment weights for a subject in a term may not
 * exceed 100. Those messages are written for the person filling this in, so
 * they are surfaced unchanged rather than pre-empted here.
 */
export async function createAssessmentAction(
  _previous: AssessmentFormState,
  form: FormData,
): Promise<AssessmentFormState> {
  await requireSession()

  const text = (key: string) => String(form.get(key) ?? '').trim()
  const assignmentId = Number(form.get('assignmentId'))
  const name = text('name')
  const assessmentType = text('assessment_type')
  const date = text('date')
  const maxMark = Number(text('max_mark'))
  const weight = Number(text('weight'))

  const values = {
    name,
    assessment_type: assessmentType,
    date,
    max_mark: text('max_mark'),
    weight: text('weight'),
    assignmentId: text('assignmentId'),
  }

  const fieldErrors: Record<string, string> = {}
  if (!Number.isInteger(assignmentId) || assignmentId <= 0) {
    fieldErrors.assignmentId = 'Choose the teaching assignment this assessment belongs to.'
  }
  if (!name) fieldErrors.name = 'A name is required.'
  if (!assessmentType) fieldErrors.assessment_type = 'Choose a type.'
  if (!date) fieldErrors.date = 'An assessment date is required.'
  if (!Number.isFinite(maxMark) || maxMark <= 0) {
    fieldErrors.max_mark = 'The maximum mark must be greater than zero.'
  }
  if (!Number.isFinite(weight) || weight < 0) {
    fieldErrors.weight = 'The weight cannot be negative.'
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values }

  let id: number
  try {
    id = await createAssessment({
      assignmentId,
      name,
      assessment_type: assessmentType,
      date,
      max_mark: maxMark,
      weight,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message, values }
  }

  revalidatePath('/assessments')
  redirect(`/assessments/${id}`)
}

export interface UnlockState {
  error?: string
  ok?: string
}

/**
 * Reopen a locked assessment for correction.
 *
 * The reason is required because Odoo requires it — it lands on the audit
 * trail as an `unlocked` event, which is the whole point of BR-11/AC-13. The
 * Exam Officer check is Odoo's and is re-run on the call.
 */
export async function unlockAssessmentAction(
  _previous: UnlockState,
  form: FormData,
): Promise<UnlockState> {
  await requireSession()

  const assessmentId = Number(form.get('assessmentId'))
  const reason = String(form.get('reason') ?? '').trim()

  if (!Number.isInteger(assessmentId) || assessmentId <= 0) {
    return { error: 'That assessment could not be identified.' }
  }
  if (!reason) return { error: 'A reason is required — it goes on the audit trail.' }

  try {
    await unlockAssessment(assessmentId, reason)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath(`/assessments/${assessmentId}`)
  return { ok: 'Reopened for correction.' }
}
