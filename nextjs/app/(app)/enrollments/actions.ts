'use server'

import { redirect } from 'next/navigation'
import { toOdooError } from '@/lib/odoo/errors'
import {
  createEnrollment,
  searchApprovedStudents,
  type StudentSearchRow,
} from '@/lib/odoo/models/student'

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