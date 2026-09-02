import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { toOdooError } from '@/lib/odoo/errors'
import { buildScheduleGrid } from '@/lib/schedule-grid'
import { formatSlotTime, listScheduleGrid } from '@/lib/odoo/models/operations'
import { listSetupClasses } from '@/lib/odoo/models/setup'
import { listTermOptions } from '@/lib/odoo/models/timetable'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Timetable grid · Async School' }

export default async function ScheduleGridPage({ searchParams }: PageProps<'/schedule/grid'>) {
  const query = await searchParams
  const classId = Number(query.class ?? '')
  const termId = Number(query.term ?? '')

  let classes, terms, days, slots
  try {
    ;[classes, terms, days] = await Promise.all([
      listSetupClasses(),
      listTermOptions(),
      selectionOptions('school.class.schedule', 'day_of_week'),
    ])
    slots = Number.isFinite(classId) && classId > 0
      ? await listScheduleGrid({
          classId,
          termId: Number.isFinite(termId) && termId > 0 ? termId : undefined,
        })
      : null
  } catch (cause) {
    return (
      <>
        <PageHeader title="Timetable grid" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/schedule" />
      </>
    )
  }

  const dayOrder = days.map((day) => day.value)
  const dayLabels = new Map(days.map((day) => [day.value, day.label]))
  const grid = slots
    ? buildScheduleGrid(
        slots.rows.map((row) => ({
          id: row.id,
          day: String(row.day_of_week || ''),
          start: row.start_time,
          end: row.end_time,
          subject: m2oLabel(row.subject_id),
          teacher: m2oLabel(row.teacher_id),
          room: m2oLabel(row.room_id),
          type: String(row.schedule_type || ''),
        })),
        dayOrder,
      )
    : null

  const chosenClass = classes?.rows.find((row) => row.id === classId)

  return (
    <>
      <PageHeader
        title="Timetable grid"
        subtitle="The whole week for one class, as it is actually taught."
        breadcrumbs={[{ label: 'Schedule', href: '/schedule' }, { label: 'Grid' }]}
        action={
          <Link
            href="/schedule"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            List view
          </Link>
        }
      />

      <Card className="mb-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <label className="block min-w-[220px] flex-1">
            <span className="mb-1.5 block text-[12px] font-medium text-graphite">Class</span>
            <select
              name="class"
              defaultValue={classId > 0 ? String(classId) : ''}
              className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite focus:border-action-blue focus:outline-none"
            >
              <option value="">Choose a class…</option>
              {(classes?.rows ?? []).map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name} — {m2oLabel(row.academic_year_id)}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-[180px] flex-1">
            <span className="mb-1.5 block text-[12px] font-medium text-graphite">Term</span>
            <select
              name="term"
              defaultValue={termId > 0 ? String(termId) : ''}
              className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite focus:border-action-blue focus:outline-none"
            >
              <option value="">All terms</option>
              {(terms?.rows ?? []).map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite"
          >
            Show
          </button>
        </form>
      </Card>

      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title={chosenClass ? chosenClass.name : 'No class chosen'}
            hint={
              grid
                ? `${grid.rows.length} period${grid.rows.length === 1 ? '' : 's'} across ${
                    grid.days.length
                  } day${grid.days.length === 1 ? '' : 's'}`
                : 'Choose a class to see its week.'
            }
          />
        </div>

        {!grid ? (
          <EmptyState
            title="Choose a class"
            hint="The grid shows one class at a time, which is how a timetable is read."
          />
        ) : grid.rows.length === 0 ? (
          <EmptyState
            title="No periods for this class"
            hint="Build a day from the schedule page."
          />
        ) : (
          // A week is wider than a phone; the table scrolls inside its own box
          // rather than pushing the page sideways.
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-[12px]">
              <thead>
                <tr className="border-y border-silver bg-paper text-left">
                  <th className="w-[92px] px-4 py-2.5 font-medium text-slate">Period</th>
                  {grid.days.map((day) => (
                    <th key={day} className="px-4 py-2.5 font-medium text-slate">
                      {dayLabels.get(day) ?? day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={`${row.start}-${row.end}`} className="border-b border-silver align-top">
                    <th
                      scope="row"
                      className="px-4 py-3 text-left font-normal text-stone tabular whitespace-nowrap"
                    >
                      {formatSlotTime(row.start)}
                      <span className="block">{formatSlotTime(row.end)}</span>
                    </th>
                    {grid.days.map((day) => (
                      <td key={day} className="px-4 py-3">
                        {(row.cells[day] ?? []).map((cell) => (
                          <Link
                            key={cell.id}
                            href={`/schedule/${cell.id}`}
                            className="mb-1.5 block last:mb-0 hover:text-action-blue"
                          >
                            <span className="block font-medium text-graphite">{cell.subject}</span>
                            <span className="block text-stone">{cell.teacher}</span>
                            {cell.room === '—' ? null : (
                              <span className="block text-stone">{cell.room}</span>
                            )}
                            {cell.type && cell.type !== 'regular' ? (
                              <span className="block text-stone">{formatSelection(cell.type)}</span>
                            ) : null}
                          </Link>
                        ))}
                        {(row.cells[day] ?? []).length === 0 ? (
                          <span className="text-stone">—</span>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
