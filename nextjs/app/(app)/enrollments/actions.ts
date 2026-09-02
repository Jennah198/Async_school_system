'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { promoteEnrollment } from '@/lib/odoo/models/student'

export interface PromotionState {
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Promote one student into the next academic year.
 *
 * Odoo owns every rule: the destination must be a later year, the effective
 * date may not precede the current enrolment, and a student already enrolled
 * for that year is refused by name. Those messages are written for the
 * registrar, so they are surfaced unchanged rather than pre-empted here.
 */
export async function promoteEnrollmentAction(
  _previous: PromotionState,
  form: FormData,
): Promise<PromotionState> {
  await requireSession()

  const enrollmentId = Number(form.get('enrollmentId'))
  const nextYearId = Number(form.get('nextYearId'))
  const nextClassId = Number(form.get('nextClassId'))
  const effectiveDate = String(form.get('effectiveDate') ?? '').trim()

  if (!Number.isInteger(enrollmentId) || enrollmentId <= 0) {
    return { error: 'That enrolment could not be identified.' }
  }

  const fieldErrors: Record<string, string> = {}
  if (!Number.isInteger(nextYearId) || nextYearId <= 0) {
    fieldErrors.nextYearId = 'Choose the year to promote into.'
  }
  if (!effectiveDate) fieldErrors.effectiveDate = 'Choose the date this takes effect.'
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  let newEnrollmentId: number | null
  try {
    newEnrollmentId = await promoteEnrollment({
      enrollmentId,
      nextYearId,
      nextClassId: Number.isInteger(nextClassId) && nextClassId > 0 ? nextClassId : undefined,
      effectiveDate,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/enrollments')
  revalidatePath(`/enrollments/${enrollmentId}`)
  redirect(newEnrollmentId ? `/enrollments/${newEnrollmentId}` : '/enrollments')
}
