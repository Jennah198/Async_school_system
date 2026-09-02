'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { generateAttendanceRoster, setAttendanceStatus } from '@/lib/odoo/models/operations'

export interface AttendanceState {
  error?: string
  ok?: string
}

/**
 * Build the roster for a class and date.
 *
 * Odoo derives it from the placements effective on that date, skips students
 * already recorded, and refuses dates outside every term of the academic year.
 * All of that stays in `school.attendance.roster.action_generate`.
 */
export async function generateRosterAction(
  _previous: AttendanceState,
  form: FormData,
): Promise<AttendanceState> {
  await requireSession()

  const classId = Number(form.get('classId'))
  const date = String(form.get('date') ?? '').trim()
  if (!Number.isFinite(classId) || classId <= 0) return { error: 'Choose a class.' }
  if (!date) return { error: 'Choose a date.' }

  try {
    await generateAttendanceRoster(classId, date)
  } catch (cause) {
    // "…is outside every term of…", "…has no active enrollment…" — Odoo's own
    // wording, which tells the user exactly what to fix.
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/attendance')
  return { ok: 'Roster generated.' }
}

export async function setAttendanceAction(
  _previous: AttendanceState,
  form: FormData,
): Promise<AttendanceState> {
  await requireSession()

  const id = Number(form.get('id'))
  const status = String(form.get('status') ?? '').trim()
  if (!Number.isFinite(id) || !status) return { error: 'That change is not available.' }

  try {
    await setAttendanceStatus(id, status)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/attendance')
  return { ok: 'Saved.' }
}
