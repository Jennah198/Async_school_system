import { Card, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  listAssignedEntries,
  listCurriculumEntries,
  listRooms,
  listTermOptions,
  listWeekdays,
} from '@/lib/odoo/models/timetable'
import { listSetupClasses } from '@/lib/odoo/models/setup'
import { m2oLabel } from '@/lib/odoo/types'

import { DayBuilderForm } from '../day-builder-form'

export const metadata = { title: 'Build a day · Async School' }

export default async function BuildDayPage() {
  let classes, terms, rooms, weekdays, curriculum, assigned, allowed
  try {
    ;[classes, terms, rooms, weekdays, curriculum, assigned, allowed] = await Promise.all([
      listSetupClasses(),
      listTermOptions(),
      listRooms(),
      listWeekdays(),
      listCurriculumEntries(),
      listAssignedEntries(),
      hasAccess('school.class.schedule', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Build a day" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Build a day" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create timetable slots. An administrator or registrar can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Build a day"
        subtitle="One class, one day of periods, optionally copied onto other days of the week."
        action={
          <LinkButton href="/schedule" icon="arrowLeft">
            Back to timetable
          </LinkButton>
        }
      />

      <Card padded={false} className="max-w-4xl">
        <div className="p-6 pb-4" />
        <DayBuilderForm
          classes={(classes?.rows ?? []).map((row) => ({
            id: row.id,
            name: `${m2oLabel(row.academic_year_id)} · ${row.name}`,
          }))}
          terms={(terms?.rows ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            yearName: m2oLabel(row.academic_year_id),
          }))}
          rooms={(rooms?.rows ?? []).map((row) => ({ id: row.id, name: row.name }))}
          weekdays={(weekdays?.rows ?? []).map((row) => ({
            id: row.id,
            name: row.name,
            code: row.code,
          }))}
          curriculum={curriculum}
          assigned={assigned}
        />
      </Card>
    </>
  )
}
