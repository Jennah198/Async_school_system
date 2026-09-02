'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { generateReportCards } from '@/lib/odoo/models/assessment'

export interface GenerateState {
  error?: string
  ok?: string
}

/**
 * Generate report cards for a class or a single student.
 *
 * Every rule stays in Odoo: that the caller is an Administrator or Exam
 * Officer, that a grading scheme with complete bands exists, that the student
 * has an enrolment for the term, and that published marks are available. Each
 * of those raises a message written for the person doing the work, so the
 * message is surfaced rather than replaced.
 */
export async function generateReportCardsAction(
  _previous: GenerateState,
  form: FormData,
): Promise<GenerateState> {
  await requireSession()

  const mode = form.get('mode') === 'student' ? 'student' : 'class'
  const termId = Number(form.get('termId'))
  const classId = Number(form.get('classId'))
  const studentId = Number(form.get('studentId'))
  const correctionReason = String(form.get('correctionReason') ?? '').trim()

  if (!Number.isInteger(termId) || termId <= 0) return { error: 'Choose a term.' }
  if (mode === 'class' && !(Number.isInteger(classId) && classId > 0)) {
    return { error: 'Choose a class.' }
  }
  if (mode === 'student' && !(Number.isInteger(studentId) && studentId > 0)) {
    return { error: 'Choose a student.' }
  }

  try {
    await generateReportCards({
      mode,
      termId,
      classId: mode === 'class' ? classId : undefined,
      studentId: mode === 'student' ? studentId : undefined,
      correctionReason: correctionReason || undefined,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/report-cards')
  return {
    ok:
      mode === 'class'
        ? 'Report cards generated for the class.'
        : 'Report card generated for the student.',
  }
}
