'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import {
  generateAttendanceRoster,
  setAttendanceStatus,
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


export interface BatchState {
  error?: string
  ok?: string
}

export async function setAttendanceBatchAction(
  changes: Array<{ id: number; status: string }>,
): Promise<BatchState> {
  await requireSession()
  if (changes.length === 0) return { ok: 'Nothing to save.' }

  try {
    await setAttendanceStatusBatch(changes)
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/attendance')
  return { ok: `Saved ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}.` }
}