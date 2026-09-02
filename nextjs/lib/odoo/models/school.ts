import 'server-only'
import { readOne, searchCount, searchRead } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import type { Domain, Ids, Many2one, Page, Selection } from '@/lib/odoo/types'

/**
 * Typed read services per school model.
 *
 * Every field list is explicit and minimal. Two reasons, both measured against
 * staging: a bare read raises AccessError for anyone below base.group_system
 * (school.staff carries system-only fields), and reading everything pulls
 * unstored computes that each run their own queries per row.
 *
 * `fayda_id` appears in exactly one place — the staff detail field list used
 * only where the caller is expected to hold the personal-data groups. Odoo
 * refuses it for anyone else with a 403, which is the intended behaviour and
 * must not be worked around.
 */

/* ------------------------------------------------------------- Students --- */

export interface StudentRow {
  id: number
  name: string
  regno: string | false
  class_id: Many2one
  academic_year_id: Many2one
  registration_status: Selection
  lifecycle_status: Selection
  gender: Selection
}

const STUDENT_LIST_FIELDS = [
  'name',
  'regno',
  'class_id',
  'academic_year_id',
  'registration_status',
  'lifecycle_status',
  'gender',
] as const

export function listStudents(options: {
  search?: string
  limit?: number
  offset?: number
}): Promise<Page<StudentRow>> {
  const domain: Domain = options.search
    ? ['|', ['name', 'ilike', options.search], ['regno', 'ilike', options.search]]
    : []
  return searchRead<StudentRow>('school.student', STUDENT_LIST_FIELDS, {
    domain,
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    order: 'name asc',
  })
}

export interface StudentDetail extends StudentRow {
  admission_number: string | false
  date_of_birth: string | false
  age: number
  guardian_name: string | false
  guardian_phone: string | false
  education_level: Selection
  admission_type: Selection
  enrollment_count: number
}

export function getStudent(id: number): Promise<StudentDetail | null> {
  return readOne<StudentDetail>('school.student', id, [
    ...STUDENT_LIST_FIELDS,
    'admission_number',
    'date_of_birth',
    'age',
    'guardian_name',
    'guardian_phone',
    'education_level',
    'admission_type',
    'enrollment_count',
  ])
}

/* ---------------------------------------------------------------- Staff --- */

export interface StaffRow {
  id: number
  name: string
  staff_id: string | false
  department: Selection
  job_title_id: Many2one
  state: Selection
  employment_status: Selection
  primary_responsibility: Selection
}

const STAFF_LIST_FIELDS = [
  'name',
  'staff_id',
  'department',
  'job_title_id',
  'state',
  'employment_status',
  'primary_responsibility',
] as const

export function listStaff(options: {
  search?: string
  limit?: number
  offset?: number
}): Promise<Page<StaffRow>> {
  const domain: Domain = options.search ? [['name', 'ilike', options.search]] : []
  return searchRead<StaffRow>('school.staff', STAFF_LIST_FIELDS, {
    domain,
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    order: 'name asc',
  })
}

/* ------------------------------------------------------------- Teachers --- */

export interface TeacherRow {
  id: number
  name: string
  teacher_id: string | false
  department: Selection
  teaching_status: Selection
  assigned_class_count: number
  assigned_subject_count: number
  total_student_count: number
  current_weekly_periods: number
}

const TEACHER_FIELDS = [
  'name',
  'teacher_id',
  'department',
  'teaching_status',
  'assigned_class_count',
  'assigned_subject_count',
  'total_student_count',
  'current_weekly_periods',
] as const

export function listTeachers(options: { limit?: number; offset?: number } = {}): Promise<
  Page<TeacherRow>
> {
  return searchRead<TeacherRow>('school.teacher', TEACHER_FIELDS, {
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    order: 'name asc',
  })
}

/* ---------------------------------------------------------- Assignments --- */

export interface AssignmentRow {
  id: number
  name: string
  teacher_id: Many2one
  subject_id: Many2one
  class_id: Many2one
  term_id: Many2one
  academic_year_id: Many2one
  weekly_periods: number
  responsibility: Selection
  state: Selection
}

const ASSIGNMENT_FIELDS = [
  'name',
  'teacher_id',
  'subject_id',
  'class_id',
  'term_id',
  'academic_year_id',
  'weekly_periods',
  'responsibility',
  'state',
] as const

export function listAssignments(options: { limit?: number; offset?: number } = {}): Promise<
  Page<AssignmentRow>
> {
  return searchRead<AssignmentRow>('school.teacher.assignment', ASSIGNMENT_FIELDS, {
    limit: options.limit ?? 25,
    offset: options.offset ?? 0,
    order: 'academic_year_id desc, term_id asc',
  })
}

/* ---------------------------------------------------------------- Marks --- */

export interface MarkRow {
  id: number
  student_id: Many2one
  subject_id: Many2one
  class_id: Many2one
  term_id: Many2one
  exam_type: Selection
  score: number
  max_score: number
  percentage: number
  /** Computed by Odoo's grading scheme. Never recomputed here. */
  grade: string | false
  mark_status: Selection
}

const MARK_FIELDS = [
  'student_id',
  'subject_id',
  'class_id',
  'term_id',
  'exam_type',
  'score',
  'max_score',
  'percentage',
  'grade',
  'mark_status',
] as const

export function listMarks(options: { limit?: number; offset?: number } = {}): Promise<
  Page<MarkRow>
> {
  return searchRead<MarkRow>('school.mark', MARK_FIELDS, {
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    order: 'student_id asc',
  })
}

/* ------------------------------------------------------------- Academic --- */

export interface ClassRow {
  id: number
  name: string
  grade_id: Many2one
  section_id: Many2one
  academic_year_id: Many2one
  education_level: Selection
  capacity: number
  student_ids: Ids
}

export function listClasses(options: { limit?: number; offset?: number } = {}): Promise<
  Page<ClassRow>
> {
  return searchRead<ClassRow>(
    'school.class',
    ['name', 'grade_id', 'section_id', 'academic_year_id', 'education_level', 'capacity', 'student_ids'],
    { limit: options.limit ?? 50, offset: options.offset ?? 0, order: 'name asc' },
  )
}

export interface SubjectRow {
  id: number
  name: string
  code: string | false
  subject_type: Selection
  active: boolean
}

export function listSubjects(options: { limit?: number; offset?: number } = {}): Promise<
  Page<SubjectRow>
> {
  return searchRead<SubjectRow>('school.subject', ['name', 'code', 'subject_type', 'active'], {
    limit: options.limit ?? 50,
    offset: options.offset ?? 0,
    order: 'name asc',
  })
}

export interface AcademicYearRow {
  id: number
  name: string
  date_start: string
  date_end: string
  state: Selection
  is_current: boolean
  class_count: number
}

export function listAcademicYears(): Promise<Page<AcademicYearRow>> {
  return searchRead<AcademicYearRow>(
    'school.academic.year',
    ['name', 'date_start', 'date_end', 'state', 'is_current', 'class_count'],
    { limit: 50, order: 'name desc' },
  )
}

/* ------------------------------------------------------------ Aggregate --- */

/**
 * A count that returns null instead of throwing when the role cannot read the
 * model at all. Four record rules are known to be ineffective, so several
 * roles legitimately get AccessError on school.student and school.mark; a
 * dashboard tile should say "not available to your role", not crash the page.
 */
export function safeCount(model: string, domain: Domain = []): Promise<number | null> {
  return orNullOnRefusal(searchCount(model, domain))
}
