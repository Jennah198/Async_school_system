import 'server-only'
import { callKw, create, hasAccess, readOne, searchRead, write } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Many2one, Page, Selection } from '@/lib/odoo/types'

/**
 * Teacher assignments — who teaches which subject, to which class, in which term.
 *
 * This is the most constrained model in the domain: eight Python constraints,
 * and `create`, `write` and `unlink` are all overridden. None of that is
 * reimplemented here. The form narrows the choices so a user is not offered a
 * combination Odoo will reject, and Odoo still refuses it if they get there
 * another way.
 *
 * The model has **no `action_*` methods** — unlike every other workflow in the
 * application, its state moves by writing the field. The existing allowlist in
 * lib/odoo/workflows.ts maps a key to a *method*, so it cannot express this;
 * `ASSIGNMENT_TRANSITIONS` below is the same idea for a field write, and keeps
 * the same property: the browser posts a transition key and a record id, never
 * a field name or a value.
 */

/* ----------------------------------------------------------------- read --- */

export interface AssignmentDetail {
  id: number
  name: string
  teacher_id: Many2one
  subject_id: Many2one
  class_id: Many2one
  term_id: Many2one
  academic_year_id: Many2one
  responsibility: Selection
  teaching_role: Selection
  weekly_periods: number
  start_date: string
  end_date: string | false
  state: Selection
  active: boolean
}

const ASSIGNMENT_DETAIL_FIELDS = [
  'name',
  'teacher_id',
  'subject_id',
  'class_id',
  'term_id',
  'academic_year_id',
  'responsibility',
  'teaching_role',
  'weekly_periods',
  'start_date',
  'end_date',
  'state',
  'active',
] as const

export function getAssignment(id: number): Promise<AssignmentDetail | null> {
  return readOne<AssignmentDetail>('school.teacher.assignment', id, ASSIGNMENT_DETAIL_FIELDS)
}

/* ------------------------------------------------------------- pickers --- */

export interface TeacherOption {
  id: number
  name: string
  teacher_id: string | false
  teaching_status: Selection
  max_weekly_workload: number
  current_weekly_periods: number
}

/**
 * Teachers who can take work.
 *
 * `_check_staff_can_take_work` refuses a suspended or resigned staff member,
 * and `_check_teacher_and_subject_active` refuses an inactive teacher for a
 * future assignment. The domain here asks Odoo for the ones that would pass.
 */
export async function listAssignableTeachers(): Promise<TeacherOption[]> {
  const page = await orNullOnRefusal(
    searchRead<TeacherOption>(
      'school.teacher',
      ['name', 'teacher_id', 'teaching_status', 'max_weekly_workload', 'current_weekly_periods'],
      {
        domain: [
          ['active', '=', true],
          ['teaching_status', '=', 'active'],
        ],
        limit: 300,
        order: 'name',
      },
    ),
  )
  return page?.rows ?? []
}

export interface ClassOption {
  id: number
  name: string
  academic_year_id: Many2one
}

export async function listAssignableClasses(): Promise<ClassOption[]> {
  const page = await orNullOnRefusal(
    searchRead<ClassOption>('school.class', ['name', 'academic_year_id'], {
      domain: [['active', '=', true]],
      limit: 300,
      order: 'name',
    }),
  )
  return page?.rows ?? []
}

/**
 * The curriculum, as a class-to-subject map.
 *
 * `_check_subject_on_curriculum` refuses a subject that is not on the class's
 * curriculum *when the class has one at all* — a class with an empty
 * curriculum accepts anything. Both halves of that rule are reproduced in the
 * form's filtering, because getting it wrong in either direction is worse than
 * not filtering: too strict and a legitimate assignment becomes impossible,
 * too loose and the user is offered a refusal.
 */
export interface CurriculumEntry {
  classId: number
  subjectId: number
  subjectName: string
}

export async function listCurriculum(): Promise<CurriculumEntry[]> {
  const page = await orNullOnRefusal(
    searchRead<{ id: number; class_id: Many2one; subject_id: Many2one }>(
      'school.grade.subject',
      ['class_id', 'subject_id'],
      { domain: [['active', '=', true]], limit: 2000, order: 'class_id' },
    ),
  )
  return (page?.rows ?? [])
    .filter((row) => row.class_id && row.subject_id)
    .map((row) => ({
      classId: (row.class_id as [number, string])[0],
      subjectId: (row.subject_id as [number, string])[0],
      subjectName: (row.subject_id as [number, string])[1],
    }))
}

export interface SubjectOption {
  id: number
  name: string
}

/** Every active subject, for classes whose curriculum is empty. */
export async function listAllSubjects(): Promise<SubjectOption[]> {
  const page = await orNullOnRefusal(
    searchRead<SubjectOption>('school.subject', ['name'], {
      domain: [['active', '=', true]],
      limit: 500,
      order: 'name',
    }),
  )
  return page?.rows ?? []
}

export interface TermOption {
  id: number
  name: string
  academic_year_id: Many2one
  date_start: string
  date_end: string
}

/**
 * Terms, with the year they belong to.
 *
 * `_check_period` refuses a term whose academic year differs from the class's,
 * so the form narrows the list once a class is chosen. `create` fills the
 * effective dates from the term, which is why this form never asks for them.
 */
export async function listTerms(): Promise<TermOption[]> {
  const page = await orNullOnRefusal(
    searchRead<TermOption>(
      'school.term',
      ['name', 'academic_year_id', 'date_start', 'date_end'],
      { domain: [['active', '=', true]], limit: 200, order: 'academic_year_id desc, sequence' },
    ),
  )
  return page?.rows ?? []
}

/** Selection labels for responsibility, teaching role and state. */
export async function assignmentFieldMeta(): Promise<
  Record<string, Array<{ value: string; label: string }>>
> {
  const raw = await callKw<Record<string, { selection?: Array<[string, string]> }>>(
    'school.teacher.assignment',
    'fields_get',
    [['responsibility', 'teaching_role', 'state']],
    { attributes: ['selection'] },
  )
  return Object.fromEntries(
    Object.entries(raw).map(([name, meta]) => [
      name,
      (meta.selection ?? []).map(([value, label]) => ({ value, label })),
    ]),
  )
}

/* ---------------------------------------------------------------- write --- */

export interface AssignmentIntake {
  teacher_id: number
  class_id: number
  subject_id: number
  term_id: number
  responsibility?: string
  teaching_role?: string
  weekly_periods?: number
  start_date?: string
  end_date?: string
}

/**
 * Create an assignment.
 *
 * `academic_year_id` is deliberately absent: it is related from
 * `class_id.academic_year_id` and stored, so Odoo derives it. Sending one
 * would either be ignored or fight the relation.
 *
 * The effective dates are also left out unless the caller set them, because
 * Odoo's `create` fills them from the term — which is the behaviour
 * `_onchange_term_id` provides in the Odoo client and which never fires over
 * RPC.
 */
export function createAssignment(intake: AssignmentIntake): Promise<number> {
  return create(
    'school.teacher.assignment',
    Object.fromEntries(
      Object.entries(intake).filter(([, value]) => value !== undefined && value !== ''),
    ),
  )
}

/** Fields an assignment may be edited through. */
export const ASSIGNMENT_EDITABLE = [
  'teacher_id',
  'subject_id',
  'class_id',
  'term_id',
  'responsibility',
  'teaching_role',
  'weekly_periods',
  'start_date',
  'end_date',
] as const

export function updateAssignment(id: number, values: Record<string, unknown>): Promise<boolean> {
  return write('school.teacher.assignment', [id], values)
}

/**
 * The state changes this application may make, and the states each is offered
 * from.
 *
 * `school.teacher.assignment` has no `action_*` methods, so unlike every other
 * workflow in the application its state moves by writing the field. That makes
 * an allowlist *more* important, not less: without one the browser would be
 * naming a field and a value. Here it names a key, and this table is the only
 * thing that turns that into a write.
 *
 * There is no transition back to `draft` from `ended` or `cancelled`, matching
 * `unlink`, which refuses to remove anything past draft: assignment history is
 * kept.
 */
export const ASSIGNMENT_TRANSITIONS = {
  activate: {
    label: 'Activate',
    from: ['draft'],
    values: { state: 'active' },
    confirm:
      'Activate this assignment? Odoo checks that nobody else already teaches this subject to this class this term, and that the teacher is within their workload.',
  },
  end: {
    label: 'End assignment',
    from: ['active'],
    values: { state: 'ended' },
    confirm: 'End this assignment? It stays on the record as history.',
  },
  cancel: {
    label: 'Cancel',
    from: ['draft', 'active'],
    values: { state: 'cancelled' },
    destructive: true,
    confirm: 'Cancel this assignment? It stays on the record as history.',
  },
  reinstate: {
    label: 'Reinstate',
    from: ['ended', 'cancelled'],
    values: { state: 'active' },
    confirm:
      'Reinstate this assignment? Odoo re-checks the single-teacher and workload rules as if it were new.',
  },
} as const

export type AssignmentTransitionKey = keyof typeof ASSIGNMENT_TRANSITIONS

export function assignmentTransitionsFrom(state: string) {
  return (Object.keys(ASSIGNMENT_TRANSITIONS) as AssignmentTransitionKey[])
    .filter((key) => (ASSIGNMENT_TRANSITIONS[key].from as readonly string[]).includes(state))
    .map((key) => ({
      key,
      label: ASSIGNMENT_TRANSITIONS[key].label,
      confirm: ASSIGNMENT_TRANSITIONS[key].confirm,
      destructive: 'destructive' in ASSIGNMENT_TRANSITIONS[key],
    }))
}

/**
 * Apply one allowlisted state change.
 *
 * The guard is checked here as well as at the point of rendering, so a posted
 * key that is not valid from the record's current state is refused before
 * anything reaches Odoo — and Odoo's constraints then run on the write anyway.
 */
export async function applyAssignmentTransition(
  id: number,
  key: AssignmentTransitionKey,
  currentState: string,
): Promise<boolean> {
  const transition = ASSIGNMENT_TRANSITIONS[key]
  if (!transition) throw new Error('unknown transition')
  if (!(transition.from as readonly string[]).includes(currentState)) {
    throw new Error('transition not available from this state')
  }
  return write('school.teacher.assignment', [id], transition.values)
}

export function canCreateAssignment(): Promise<boolean> {
  return hasAccess('school.teacher.assignment', 'create')
}

export function canWriteAssignment(): Promise<boolean> {
  return hasAccess('school.teacher.assignment', 'write')
}

/** Other assignments for the same class and term — the clash context. */
export function listClassTermAssignments(
  classId: number,
  termId: number,
  excludeId?: number,
): Promise<Page<AssignmentDetail> | null> {
  return orNullOnRefusal(
    searchRead<AssignmentDetail>('school.teacher.assignment', ASSIGNMENT_DETAIL_FIELDS, {
      domain: [
        ['class_id', '=', classId],
        ['term_id', '=', termId],
        ['state', '=', 'active'],
        ...(excludeId ? [['id', '!=', excludeId]] : []),
      ],
      limit: 50,
      order: 'subject_id',
    }),
  )
}
