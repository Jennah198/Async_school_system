import 'server-only'
import {
  assignmentFieldMeta,
  listAllSubjects,
  listAssignableClasses,
  listAssignableTeachers,
  listCurriculum,
  listTerms,
} from '@/lib/odoo/models/assignment'
import type { PickerData } from './assignment-form'
import { m2oId, m2oLabel } from '@/lib/odoo/types'

/**
 * Everything the assignment form needs to narrow its choices, in one pass.
 *
 * Six reads issued together rather than in sequence: the form needs all of
 * them before it can render, and the alternative — fetching subjects when a
 * class is picked, terms when a year is known — would be a round trip per
 * keystroke for data that is small and changes rarely.
 */
export async function loadAssignmentPickers(): Promise<PickerData> {
  const [teachers, classes, subjects, curriculum, terms, meta] = await Promise.all([
    listAssignableTeachers(),
    listAssignableClasses(),
    listAllSubjects(),
    listCurriculum(),
    listTerms(),
    assignmentFieldMeta(),
  ])

  return {
    teachers: teachers.map((teacher) => ({
      id: teacher.id,
      name: teacher.name,
      teacher_id: String(teacher.teacher_id || ''),
      periods: teacher.current_weekly_periods ?? 0,
      max: teacher.max_weekly_workload ?? 0,
    })),
    classes: classes.map((klass) => ({
      id: klass.id,
      name: klass.name,
      yearId: m2oId(klass.academic_year_id) ?? 0,
      yearName: m2oLabel(klass.academic_year_id, ''),
    })),
    subjects,
    curriculum: curriculum.map(({ classId, subjectId }) => ({ classId, subjectId })),
    terms: terms.map((term) => ({
      id: term.id,
      name: term.name,
      yearId: m2oId(term.academic_year_id) ?? 0,
      start: String(term.date_start || ''),
      end: String(term.date_end || ''),
    })),
    responsibilities: meta.responsibility ?? [],
    teachingRoles: meta.teaching_role ?? [],
  }
}
