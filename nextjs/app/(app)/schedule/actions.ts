'use server'

import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/odoo/auth'
import { toOdooError } from '@/lib/odoo/errors'
import { buildDay, type DayBuilderPeriod } from '@/lib/odoo/models/timetable'

export interface DayBuilderState {
  error?: string
  ok?: string
  fieldErrors?: Record<string, string>
}

const SCHEDULE_TYPES = new Set(['regular', 'tutorial', 'laboratory', 'examination'])

/**
 * Build a day of periods for one class.
 *
 * The times are not sent: Odoo chains them from the first start, the period
 * length and the break, which is also what keeps a copied day consistent. Each
 * period's teacher comes from the exact active assignment for that subject,
 * class and term, and Odoo refuses the whole build if any period lacks one —
 * that message names the subject, so it is surfaced unchanged.
 */
export async function buildDayAction(
  _previous: DayBuilderState,
  form: FormData,
): Promise<DayBuilderState> {
  await requireSession()

  const classId = Number(form.get('classId'))
  const termId = Number(form.get('termId'))
  const dayOfWeek = String(form.get('dayOfWeek') ?? '')
  const firstStartTime = Number(form.get('firstStartTime'))
  const periodMinutes = Number(form.get('periodMinutes'))
  const breakMinutes = Number(form.get('breakMinutes'))
  const defaultRoomId = Number(form.get('defaultRoomId'))
  const state = form.get('state') === 'draft' ? 'draft' : 'published'

  const repeatWeekdayIds = form
    .getAll('repeatWeekdayIds')
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)

  const subjectIds = form.getAll('periodSubjectId').map(Number)
  const roomIds = form.getAll('periodRoomId').map(Number)
  const types = form.getAll('periodType').map(String)

  const periods: DayBuilderPeriod[] = subjectIds.flatMap((subjectId, index) => {
    if (!Number.isInteger(subjectId) || subjectId <= 0) return []
    const roomId = roomIds[index]
    return [
      {
        subjectId,
        roomId: Number.isInteger(roomId) && roomId > 0 ? roomId : undefined,
        scheduleType: SCHEDULE_TYPES.has(types[index]) ? types[index] : 'regular',
      },
    ]
  })

  const fieldErrors: Record<string, string> = {}
  if (!Number.isInteger(classId) || classId <= 0) fieldErrors.classId = 'Choose a class.'
  if (!Number.isInteger(termId) || termId <= 0) fieldErrors.termId = 'Choose a term.'
  if (!dayOfWeek) fieldErrors.dayOfWeek = 'Choose a day.'
  if (!Number.isFinite(firstStartTime) || firstStartTime < 0 || firstStartTime >= 24) {
    fieldErrors.firstStartTime = 'Enter a start time within the day.'
  }
  if (!Number.isInteger(periodMinutes) || periodMinutes <= 0) {
    fieldErrors.periodMinutes = 'A period has to last some minutes.'
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0) {
    fieldErrors.breakMinutes = 'A break cannot be negative.'
  }
  if (periods.length === 0) fieldErrors.periods = 'Add at least one period.'
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors }

  try {
    await buildDay({
      classId,
      termId,
      dayOfWeek,
      repeatWeekdayIds,
      firstStartTime,
      periodMinutes,
      breakMinutes,
      defaultRoomId: Number.isInteger(defaultRoomId) && defaultRoomId > 0 ? defaultRoomId : undefined,
      state,
      periods,
    })
  } catch (cause) {
    return { error: toOdooError(cause).message }
  }

  revalidatePath('/schedule')
  const days = repeatWeekdayIds.length + 1
  return {
    ok: `${periods.length} ${periods.length === 1 ? 'period' : 'periods'} created across ${days} ${days === 1 ? 'day' : 'days'}.`,
  }
}
