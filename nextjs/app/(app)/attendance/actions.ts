'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { changedStatuses } from '@/lib/attendance-diff'
import { toOdooError } from '@/lib/odoo/errors'
import {
  generateAttendanceRoster,
  setAttendanceStatusBatch,
} from '@/lib/odoo/models/operations'

export interface AttendanceState {
  error?: string
  ok?: string
}

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
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/attendance')
  // Land the user on exactly the roster they just built/opened — this is what
  // makes "take attendance" behave like opening a session instead of firing a
  // background job. Existing rows show pre-filled (edit); new ones show blank
  // (entry). Must stay outside the try/catch — redirect() throws internally.
  redirect(`/attendance?${new URLSearchParams({ class: String(classId), date }).toString()}`)
}


export interface BatchState {
  error?: string
  ok?: string
}

/**
 * Save every changed row of an attendance register in one pass.
 *
 * `setAttendanceStatusBatch` groups the changes by target status, so a class
 * that settles on "present" costs one write rather than thirty. Odoo still
 * authorises each one and owns the placement rules behind the register.
 */
export async function setAttendanceBatchAction(
  _previous: BatchState,
  form: FormData,
): Promise<BatchState> {
  await requireSession()

  const ids = form
    .getAll('attendanceId')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  if (ids.length === 0) return { error: 'This register has no rows to save.' }

  const changes = changedStatuses(form, ids)
  if (changes.length === 0) return { ok: 'No changes to save.' }

  try {
    await setAttendanceStatusBatch(changes)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/attendance')
  return { ok: `Saved ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}.` }
}
