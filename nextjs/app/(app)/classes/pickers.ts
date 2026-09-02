import 'server-only'
import { listAcademicYears } from '@/lib/odoo/models/school'
import { listConfig } from '@/lib/odoo/models/operations'
import { listTeachers } from '@/lib/odoo/models/school'
import { selectionOptions } from '@/lib/odoo/selections'
import type { ClassFormPickers } from './class-form'

const options = (rows: Array<{ id: number; name: string }> | undefined) =>
  (rows ?? []).map((row) => ({ value: String(row.id), label: row.name }))

/**
 * Everything the class form picks from, and the grade → level map its stream
 * rule needs. Vocabularies a role cannot read come back null and simply become
 * an empty picker rather than failing the page.
 */
export async function classPickers(): Promise<{
  pickers: ClassFormPickers
  gradeLevels: Record<string, string>
}> {
  const [grades, sections, streams, shifts, campuses, rooms, years, levels, teachers] =
    await Promise.all([
      listConfig('grades'),
      listConfig('sections'),
      listConfig('streams'),
      listConfig('shifts'),
      listConfig('campuses'),
      listConfig('rooms'),
      listAcademicYears({ limit: 50 }),
      selectionOptions('school.class', 'education_level'),
      listTeachers({ limit: 200 }),
    ])

  const gradeLevels: Record<string, string> = {}
  for (const grade of grades?.rows ?? []) {
    gradeLevels[String(grade.id)] = String(grade.level ?? '')
  }

  return {
    pickers: {
      grades: options(grades?.rows),
      sections: options(sections?.rows),
      streams: options(streams?.rows),
      shifts: options(shifts?.rows),
      campuses: options(campuses?.rows),
      rooms: options(rooms?.rows),
      years: options(years.rows),
      levels,
      teachers: options(teachers.rows),
    },
    gradeLevels,
  }
}
