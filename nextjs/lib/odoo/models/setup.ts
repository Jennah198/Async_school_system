import 'server-only'
import { callKw, create, searchRead } from '@/lib/odoo/client'
import { orNullOnRefusal } from '@/lib/odoo/errors'
import { ethiopianYearOf } from '@/lib/ethiopian-date'
import type { Many2one, Page } from '@/lib/odoo/types'

/**
 * The three setup wizards behind "Academic setup".
 *
 * Each is a transient model: create it with the values, then call its own
 * apply method. None of what they do is reimplemented here — `_ensure_sections`
 * decides how a class is named and whether it already exists, `_prepare_terms`
 * splits a year into terms, and the curriculum wizard decides which existing
 * rows to reactivate rather than duplicate.
 */

/* ------------------------------------------------------------ vocabulary --- */

export interface NamedRow {
  id: number
  name: string
}

export interface GradeRow extends NamedRow {
  level: string | false
}

export interface ClassRow extends NamedRow {
  academic_year_id: Many2one
}

function list<T extends NamedRow>(model: string, fields: string[], order: string) {
  return orNullOnRefusal(
    searchRead<T>(model, fields, { domain: [['active', '=', true]], limit: 300, order }),
  )
}

export function listSetupGrades(): Promise<Page<GradeRow> | null> {
  return list<GradeRow>('school.grade', ['name', 'level'], 'sequence, name')
}

export function listSetupSections(): Promise<Page<NamedRow> | null> {
  return list<NamedRow>('school.section', ['name'], 'sequence, name')
}

export function listSetupSubjects(): Promise<Page<NamedRow> | null> {
  return list<NamedRow>('school.subject', ['name'], 'name')
}

export function listSetupClasses(): Promise<Page<ClassRow> | null> {
  return list<ClassRow>('school.class', ['name', 'academic_year_id'], 'academic_year_id desc, name')
}


/* ---------------------------------------------------------- school setup --- */

export interface SchoolSetupIntake {
  dateStart: string
  dateEnd: string
  isCurrent: boolean
  termCount: '1' | '2' | '3' | '4'
  gradeIds: number[]
  sectionNames: string
}

/**
 * Open an academic year: the year itself, its terms, and one class per grade
 * and section.
 *
 * The year name is derived rather than typed — Odoo requires it to be the
 * Ethiopian year of the start date, exactly as `school.academic.year` does.
 */
export async function runSchoolSetup(intake: SchoolSetupIntake): Promise<void> {
  const year = ethiopianYearOf(intake.dateStart)
  if (year === null) throw new Error('The start date is not a valid date.')

  const wizardId = await create('school.setup.wizard', {
    year_name: String(year),
    date_start: intake.dateStart,
    date_end: intake.dateEnd,
    is_current: intake.isCurrent,
    term_count: intake.termCount,
    grade_ids: [[6, 0, intake.gradeIds]],
    section_names: intake.sectionNames,
  })
  await callKw('school.setup.wizard', 'action_apply', [[wizardId]])
}

/* --------------------------------------------------------- grade sections --- */

export interface GradeSectionIntake {
  gradeId: number
  academicYearId: number
  sectionIds: number[]
  newSectionNames: string
}

/** Add sections to a grade for one year, creating any typed on the fly. */
export async function ensureGradeSections(intake: GradeSectionIntake): Promise<void> {
  const wizardId = await create('school.grade.section.wizard', {
    grade_id: intake.gradeId,
    academic_year_id: intake.academicYearId,
    section_ids: [[6, 0, intake.sectionIds]],
    new_section_names: intake.newSectionNames,
  })
  await callKw('school.grade.section.wizard', 'action_confirm', [[wizardId]])
}

/* ------------------------------------------------------------ curriculum --- */

export interface ClassSubjectIntake {
  classId: number
  subjectIds: number[]
  subjectType: string
  maximumMark: number
  passMark: number
}

/**
 * Set the subjects a class studies.
 *
 * The wizard reconciles rather than replaces: subjects already on the class
 * are reactivated, ones dropped are deactivated, and only genuinely new ones
 * are created. Curriculum history is never hard-deleted.
 */
export async function setClassSubjects(intake: ClassSubjectIntake): Promise<void> {
  const wizardId = await create('school.class.subject.wizard', {
    class_id: intake.classId,
    subject_ids: [[6, 0, intake.subjectIds]],
    subject_type: intake.subjectType,
    maximum_mark: intake.maximumMark,
    pass_mark: intake.passMark,
  })
  await callKw('school.class.subject.wizard', 'action_apply', [[wizardId]])
}
