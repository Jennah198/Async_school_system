'use server'

import { revalidatePath } from 'next/cache' 
import { redirect } from 'next/navigation' 
import { requireSession } from '@/lib/odoo/auth' 
import { toOdooError } from '@/lib/odoo/errors' 
import { createEnrollment, promoteEnrollment, searchApprovedStudents, type StudentSearchRow, }from '@/lib/odoo/models/student'


export async function searchStudentsAction(query: string): Promise<StudentSearchRow[]> {
  if (query.trim().length < 2) return []
  return searchApprovedStudents(query)
}

export interface EnrollmentFormState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

export async function createEnrollmentAction(
  _prevState: EnrollmentFormState,
  formData: FormData,
): Promise<EnrollmentFormState> {
  const raw = {
    student_id: String(formData.get('student_id') || ''),
    class_id: String(formData.get('class_id') || ''),
    admission_type: String(formData.get('admission_type') || ''),
    enrollment_date: String(formData.get('enrollment_date') || ''),
  }

  const fieldErrors: Record<string, string> = {}
  if (!raw.student_id) fieldErrors.student_id = 'Pick a student from the list.'
  if (!raw.class_id) fieldErrors.class_id = 'Choose a grade / class.'
  if (!raw.admission_type) fieldErrors.admission_type = 'Choose an admission type.'
  if (!raw.enrollment_date) fieldErrors.enrollment_date = 'Enter an enrollment date.'

  if (Object.keys(fieldErrors).length > 0) {
    return { fieldErrors, values: raw }
  }

  let enrollmentId: number
  try {
    enrollmentId = await createEnrollment({
      student_id: Number(raw.student_id),
      class_id: Number(raw.class_id),
      admission_type: raw.admission_type,
      enrollment_date: raw.enrollment_date,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message, values: raw }
  }

  redirect(`/enrollments/${enrollmentId}`)
}

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
