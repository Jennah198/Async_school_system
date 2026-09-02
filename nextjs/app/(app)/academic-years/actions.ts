'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ethiopianYearOf } from '@/lib/ethiopian-date'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { createAcademicYear } from '@/lib/odoo/models/school'

export interface AcademicYearFormState {
  error?: string
  fieldErrors?: Record<string, string>
  values?: Record<string, string>
}

/**
 * Create an academic year.
 *
 * The name is not collected — it is the Ethiopian year of the start date, and
 * `createAcademicYear` derives it. The date ordering is checked here only to
 * give a better message than the database constraint would; Odoo enforces it
 * either way, along with the name/start-date agreement and single-current rule.
 */
export async function createAcademicYearAction(
  _previous: AcademicYearFormState,
  form: FormData,
): Promise<AcademicYearFormState> {
  await requireSession()

  const dateStart = String(form.get('date_start') ?? '')
  const dateEnd = String(form.get('date_end') ?? '')
  const isCurrent = form.get('is_current') === 'on'
  const values = { date_start: dateStart, date_end: dateEnd }

  const fieldErrors: Record<string, string> = {}
  if (!dateStart) fieldErrors.date_start = 'A start date is required.'
  if (!dateEnd) fieldErrors.date_end = 'An end date is required.'
  if (dateStart && dateEnd && dateEnd <= dateStart) {
    fieldErrors.date_end = 'The end date must be after the start date.'
  }
  if (dateStart && ethiopianYearOf(dateStart) === null) {
    fieldErrors.date_start = 'That start date could not be read.'
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors, values }

  let id: number
  try {
    id = await createAcademicYear({
      date_start: dateStart,
      date_end: dateEnd,
      is_current: isCurrent,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message, values }
  }

  revalidatePath('/academic-years')
  redirect(`/academic-years/${id}`)
}
