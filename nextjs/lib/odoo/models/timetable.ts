import 'server-only'
import { callKw, create, searchRead } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Many2one, Page } from '@/lib/odoo/types'

/**
 * The day builder: a whole day of periods for one class, in one call.
 *
 * `school.day.builder` is a transient with a line per period. Odoo chains the
 * times itself from the first start, the period length and the break, resolves
 * the teacher from the exact active assignment for each subject, and refuses
 * the build if any period has none. None of that is repeated here.
 */

export interface WeekdayRow {
  id: number
  name: string
  code: string
}

export function listWeekdays(): Promise<Page<WeekdayRow> | null> {
  return orNullOnRefusal(
    searchRead<WeekdayRow>('school.weekday', ['name', 'code'], { limit: 20, order: 'code' }),
  )
}

export interface RoomRow {
  id: number
  name: string
}

export function listRooms(): Promise<Page<RoomRow> | null> {
  return orNullOnRefusal(
    searchRead<RoomRow>('school.room', ['name'], {
      domain: [['active', '=', true]],
      limit: 200,
      order: 'name',
    }),
  )
}

export interface TermRow {
  id: number
  name: string
  academic_year_id: Many2one
}

export function listTermOptions(): Promise<Page<TermRow> | null> {
  return orNullOnRefusal(
    searchRead<TermRow>('school.term', ['name', 'academic_year_id'], {
      limit: 100,
      order: 'academic_year_id desc, sequence',
    }),
  )
}

export interface CurriculumEntry {
  classId: number
  subjectId: number
  subjectName: string
}

export interface AssignedEntry {
  classId: number
  termId: number
  subjectId: number
}

function pair(value: unknown): [number, string] | null {
  return Array.isArray(value) ? [value[0] as number, value[1] as string] : null
}

/**
 * Every class curriculum row, flat.
 *
 * The form intersects this with the active assignments to offer only subjects a
 * period can actually be built from — the same set the wizard computes as
 * `schedulable_subject_ids`. It is only there to keep the picker honest: Odoo
 * re-resolves the assignment per period on build and refuses anything without
 * one.
 */
export async function listCurriculumEntries(): Promise<CurriculumEntry[]> {
  const rows = await searchRead<{ class_id: Many2one; subject_id: Many2one }>(
    'school.grade.subject',
    ['class_id', 'subject_id'],
    { domain: [['active', '=', true]], limit: 1000 },
  )
  return rows.rows.flatMap((row) => {
    const cls = pair(row.class_id)
    const subject = pair(row.subject_id)
    return cls && subject
      ? [{ classId: cls[0], subjectId: subject[0], subjectName: subject[1] }]
      : []
  })
}

/** Every active teacher assignment, flat, for the same intersection. */
export async function listAssignedEntries(): Promise<AssignedEntry[]> {
  const rows = await searchRead<{ class_id: Many2one; term_id: Many2one; subject_id: Many2one }>(
    'school.teacher.assignment',
    ['class_id', 'term_id', 'subject_id'],
    { domain: [['state', '=', 'active'], ['active', '=', true]], limit: 1000 },
  )
  return rows.rows.flatMap((row) => {
    const cls = pair(row.class_id)
    const term = pair(row.term_id)
    const subject = pair(row.subject_id)
    return cls && term && subject
      ? [{ classId: cls[0], termId: term[0], subjectId: subject[0] }]
      : []
  })
}

export interface DayBuilderPeriod {
  subjectId: number
  roomId?: number
  scheduleType: string
}

export interface DayBuilderIntake {
  classId: number
  termId: number
  dayOfWeek: string
  repeatWeekdayIds: number[]
  firstStartTime: number
  periodMinutes: number
  breakMinutes: number
  defaultRoomId?: number
  state: 'draft' | 'published'
  periods: DayBuilderPeriod[]
}

/** Build one day of periods, optionally copied onto further weekdays. */
export async function buildDay(intake: DayBuilderIntake): Promise<void> {
  const wizardId = await create('school.day.builder', {
    class_id: intake.classId,
    term_id: intake.termId,
    day_of_week: intake.dayOfWeek,
    repeat_day_ids: [[6, 0, intake.repeatWeekdayIds]],
    first_start_time: intake.firstStartTime,
    period_minutes: intake.periodMinutes,
    break_minutes: intake.breakMinutes,
    default_room_id: intake.defaultRoomId ?? false,
    state: intake.state,
    line_ids: intake.periods.map((period, index) => [
      0,
      0,
      {
        sequence: (index + 1) * 10,
        subject_id: period.subjectId,
        room_id: period.roomId ?? false,
        schedule_type: period.scheduleType,
      },
    ]),
  })
  await callKw('school.day.builder', 'action_build', [[wizardId]])
}
