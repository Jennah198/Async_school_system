import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader, Pagination, Toolbar } from '@/components/ui'
import { DateFilter, FilterSelect, SearchField } from '@/components/list-toolbar'
import { pluralise, todayIso } from '@/lib/format'
import { listHrefs, parseListQuery, toOdooOrder } from '@/lib/list-query'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { classOptions } from '@/lib/odoo/filter-options'
import { attendanceStatusOptions, listAttendance } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'
import { AttendanceList } from './attendance-list'
import { RosterForm } from './roster-form'

export const metadata = { title: 'Attendance · Async School' }

const FILTER_KEYS = ['date', 'class', 'status', 'type'] as const
const PAGE_SIZE = 50

/**
 * Attendance is the one list whose natural axis is a single day and class, so
 * it keeps its own layout: the roster generator sits above the register rather
 * than behind a "create" button, because taking attendance is the task, not
 * browsing rows.
 */
export default async function AttendancePage({ searchParams }: PageProps<'/attendance'>) {
  const params = await searchParams
  const query = parseListQuery(params, {
    filterKeys: FILTER_KEYS,
    sortFields: ['date', 'student_id', 'status'],
    defaultSort: { field: 'date', direction: 'desc' },
    pageSize: PAGE_SIZE,
  })
  const hrefs = listHrefs('/attendance', params, query)

  let attendance, classes, statuses, canWrite
  try {
    ;[attendance, classes, statuses, canWrite] = await Promise.all([
      listAttendance({
        search: query.search,
        filters: query.filters,
        order: toOdooOrder(query),
        limit: query.limit,
        offset: query.offset,
      }),
      classOptions(),
      attendanceStatusOptions(),
      hasAccess('school.attendance', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Attendance" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/attendance" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Each row is anchored to the enrolment placement effective on its date."
      />

      {canWrite ? (
        <Card className="mb-4">
          <CardHeader
            title="Take attendance"
            icon="attendance"
            hint="Odoo builds the roster from the placements effective on that date and skips anyone already recorded."
          />
          <RosterForm classes={classes} defaultDate={query.filters.date ?? todayIso()} />
        </Card>
      ) : null}

      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader
            title="Register"
            hint={`${pluralise(attendance.total, 'record')} visible to you`}
          />
        </div>

        <Toolbar
          hint={
            hrefs.isNarrowed ? (
              <Link href={hrefs.cleared} className="text-action-blue hover:underline">
                Clear filters
              </Link>
            ) : undefined
          }
        >
          <SearchField placeholder="Student name" />
          <DateFilter />
          <FilterSelect filter={{ key: 'class', label: 'Class', options: classes }} />
          <FilterSelect filter={{ key: 'status', label: 'Status', options: statuses }} />
        </Toolbar>

        {attendance.rows.length === 0 ? (
          <EmptyState
            icon="attendance"
            title={hrefs.isNarrowed ? 'Nothing matches those filters' : 'No attendance recorded'}
            hint={
              hrefs.isNarrowed
                ? 'Try another date or class, or clear the filters.'
                : canWrite
                  ? 'Choose a class and date above to build the roster.'
                  : 'A teacher or the registrar records attendance for each class.'
            }
          />
        ) : (
          <AttendanceList
            rows={attendance.rows.map((row) => ({
              id: row.id,
              date: row.date,
              student: m2oLabel(row.student_id),
              className: m2oLabel(row.class_id),
              attendanceType: row.attendance_type,
              period: row.period,
              status: String(row.status || ''),
            }))}
            statuses={statuses}
            editable={canWrite}
          />
        )}

        <Pagination
          page={query.page}
          pageSize={PAGE_SIZE}
          total={attendance.total}
          hrefForPage={hrefs.forPage}
        />
      </Card>
    </>
  )
}
