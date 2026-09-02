import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { BarChart } from '@/components/ui/bar-chart'
import { formatSelection } from '@/lib/format'
import { toOdooError } from '@/lib/odoo/errors'
import { aggregate, groupLabel, ASSIGNMENT_MEASURE } from '@/lib/odoo/models/analytics'
import { selectionOptions } from '@/lib/odoo/selections'

export const metadata = { title: 'Teaching workload - Async School' }

/**
 * Odoo's `school.teacher.assignment.graph` and `school.class.schedule.graph`.
 *
 * Periods per week is a real total, so unlike the mark measure this one sums.
 * The second chart counts timetabled slots per teacher per weekday, which is
 * where an unevenly loaded week shows up.
 */
export default async function WorkloadPage() {
  let byTeacher, byTeacherDay, days
  try {
    ;[byTeacher, byTeacherDay, days] = await Promise.all([
      aggregate('school.teacher.assignment', {
        measures: [ASSIGNMENT_MEASURE],
        groupby: ['teacher_id'],
      }),
      aggregate('school.class.schedule', {
        domain: [['state', '!=', 'cancelled']],
        groupby: ['teacher_id', 'day_of_week'],
      }),
      selectionOptions('school.class.schedule', 'day_of_week'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Teaching workload" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/assignments" />
      </>
    )
  }

  const loadRows = (byTeacher ?? []).filter((row) => Number(row[ASSIGNMENT_MEASURE] ?? 0) > 0)
  const teachers = loadRows.map((row) => groupLabel(row.teacher_id, 'Unassigned'))
  const periods = loadRows.map((row) => Number(row[ASSIGNMENT_MEASURE] ?? 0))

  const scheduleRows = byTeacherDay ?? []
  const scheduleTeachers: string[] = []
  for (const row of scheduleRows) {
    const teacher = groupLabel(row.teacher_id, 'Unassigned')
    if (!scheduleTeachers.includes(teacher)) scheduleTeachers.push(teacher)
  }
  const dayOrder = days.map((day) => day.label)
  const slots = (teacher: string, dayLabel: string) =>
    scheduleRows.find(
      (row) =>
        groupLabel(row.teacher_id, 'Unassigned') === teacher &&
        formatSelection(groupLabel(row.day_of_week, '')) ===
          formatSelection(dayLabel),
    )?.__count ?? 0

  return (
    <>
      <PageHeader
        title="Teaching workload"
        subtitle="Assigned periods per week, and how the timetable actually falls across the week."
        breadcrumbs={[{ label: 'Assignments', href: '/assignments' }, { label: 'Workload' }]}
        action={
          <Link
            href="/assignments"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Assignment list
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Periods per week"
            hint="Summed across every active assignment - this one is a genuine total."
          />
          {teachers.length === 0 ? (
            <EmptyState
              title="No teaching assignments"
              hint="Assign a teacher to a class and subject to see a workload here."
            />
          ) : (
            <BarChart
              categories={teachers}
              caption="Assigned periods per week, by teacher."
              series={[{ label: 'Periods', values: periods }]}
            />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Timetabled slots by day"
            hint="Stacked per weekday, so a lopsided week is visible."
          />
          {scheduleTeachers.length === 0 ? (
            <EmptyState
              title="Nothing timetabled"
              hint="Build a day from the schedule page."
            />
          ) : (
            <BarChart
              stacked
              categories={scheduleTeachers}
              caption="Timetabled periods per teacher, stacked by weekday."
              series={dayOrder.map((day) => ({
                label: day,
                values: scheduleTeachers.map((teacher) => slots(teacher, day)),
              }))}
            />
          )}
        </Card>
      </div>
    </>
  )
}
