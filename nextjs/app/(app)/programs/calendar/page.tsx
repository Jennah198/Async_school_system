import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import {
  ETHIOPIAN_MONTHS,
  ETHIOPIAN_WEEKDAYS,
  daysInEthiopianMonth,
  ethiopianWeekday,
  parseIsoDate,
  toEthiopian,
  toGregorian,
  toIsoDate,
} from '@/lib/ethiopian-date'
import { formatSelection, todayIso } from '@/lib/format'
import { toOdooError } from '@/lib/odoo/errors'
import { listPrograms } from '@/lib/odoo/models/operations'

export const metadata = { title: 'Programme calendar - Async School' }

/**
 * Odoo's `school.program.calendar`, on the Ethiopian calendar the rest of the
 * app already uses.
 *
 * A programme occupies the day it starts. Multi-day programmes are not spread
 * across cells: a month grid that draws spans needs a row-packing pass, and
 * showing a start date honestly beats drawing a bar that implies more
 * precision than one column of data carries.
 */
export default async function ProgramCalendarPage({
  searchParams,
}: PageProps<'/programs/calendar'>) {
  const query = await searchParams
  // todayIso is the app's single source of "today", so the calendar opens on
  // the same day every other screen would call today.
  const gregorianToday = parseIsoDate(todayIso())
  const today = gregorianToday
    ? toEthiopian(gregorianToday)
    : { year: 0, month: 1, day: 1 }
  const year = Number(query.year ?? '') || today.year
  const month = Number(query.month ?? '') || today.month

  let programs
  try {
    programs = await listPrograms({ limit: 200 })
  } catch (cause) {
    return (
      <>
        <PageHeader title="Programme calendar" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/programs" />
      </>
    )
  }

  const dayCount = daysInEthiopianMonth(year, month)
  const firstWeekday = ethiopianWeekday({ year, month, day: 1 })

  // Programmes keyed by the Ethiopian day they start on.
  const byDay = new Map<number, typeof programs.rows>()
  for (const program of programs.rows) {
    const iso = String(program.start_datetime || '').slice(0, 10)
    const gregorian = iso ? parseIsoDate(iso) : null
    if (!gregorian) continue
    const ethiopian = toEthiopian(gregorian)
    if (ethiopian.year !== year || ethiopian.month !== month) continue
    const existing = byDay.get(ethiopian.day) ?? []
    byDay.set(ethiopian.day, [...existing, program])
  }

  const step = (delta: number) => {
    const index = (month - 1 + delta + 13) % 13
    const nextYear = year + Math.floor((month - 1 + delta) / 13)
    return `/programs/calendar?year=${nextYear}&month=${index + 1}`
  }

  const inMonth = [...byDay.values()].reduce((sum, rows) => sum + rows.length, 0)

  return (
    <>
      <PageHeader
        title="Programme calendar"
        subtitle={`${ETHIOPIAN_MONTHS[month - 1]} ${year} - ${inMonth} programme${inMonth === 1 ? '' : 's'} starting this month`}
        breadcrumbs={[{ label: 'Programmes', href: '/programs' }, { label: 'Calendar' }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={step(-1)}
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Previous
            </Link>
            <Link
              href={step(1)}
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Next
            </Link>
            <Link
              href="/programs"
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              List view
            </Link>
          </div>
        }
      />

      <Card padded={false}>
        <div className="p-6 pb-4">
          <CardHeader
            title={`${ETHIOPIAN_MONTHS[month - 1]} ${year}`}
            hint="Each programme sits on the day it starts."
          />
        </div>

        {programs.rows.length === 0 ? (
          <EmptyState title="No programmes recorded" />
        ) : (
          <div className="overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-7 border-t border-silver">
              {ETHIOPIAN_WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  className="border-b border-silver bg-paper px-3 py-2 text-[11px] font-medium text-slate"
                >
                  {weekday}
                </div>
              ))}

              {Array.from({ length: firstWeekday }, (_, index) => (
                <div key={`pad-${index}`} className="min-h-[92px] border-b border-r border-silver" />
              ))}

              {Array.from({ length: dayCount }, (_, index) => {
                const day = index + 1
                const rows = byDay.get(day) ?? []
                const iso = toIsoDate(toGregorian({ year, month, day }))
                return (
                  <div
                    key={day}
                    className="min-h-[92px] min-w-0 border-b border-r border-silver p-2"
                  >
                    <p className="mb-1 text-[11px] text-stone tabular">
                      <span title={iso}>{day}</span>
                    </p>
                    {rows.map((program) => (
                      <Link
                        key={program.id}
                        href={`/programs/${program.id}`}
                        className="mb-1 block rounded-[6px] bg-paper px-2 py-1 text-[11px] text-graphite hover:bg-silver/40"
                      >
                        <span className="block truncate font-medium">{program.name}</span>
                        <span className="block truncate text-stone">
                          {formatSelection(program.program_type)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </>
  )
}
