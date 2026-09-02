import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { BarChart } from '@/components/ui/bar-chart'
import { PivotTable } from '@/components/ui/pivot-table'
import { formatSelection } from '@/lib/format'
import { toOdooError } from '@/lib/odoo/errors'
import { aggregate, groupLabel } from '@/lib/odoo/models/analytics'
import type { GroupedRow } from '@/lib/pivot'

export const metadata = { title: 'Attendance analysis - Async School' }

/**
 * Odoo's `school.attendance.graph` and `school.attendance.pivot`.
 *
 * Both count records rather than measuring a field, so the cells sum: fifty
 * present and three absent is a total, not an average. The graph is stacked
 * because the whole -- how many were marked at all -- matters as much as the
 * split.
 */
export default async function AttendanceAnalysisPage() {
  let byClassStatus
  try {
    byClassStatus = await aggregate('school.attendance', {
      groupby: ['class_id', 'status'],
    })
  } catch (cause) {
    return (
      <>
        <PageHeader title="Attendance analysis" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/attendance" />
      </>
    )
  }

  const rows = byClassStatus ?? []
  const classes: string[] = []
  const statuses: string[] = []
  for (const row of rows) {
    const klass = groupLabel(row.class_id, 'No class')
    const status = formatSelection(groupLabel(row.status, 'unset'))
    if (!classes.includes(klass)) classes.push(klass)
    if (!statuses.includes(status)) statuses.push(status)
  }

  const count = (klass: string, status: string) =>
    rows.find(
      (row) =>
        groupLabel(row.class_id, 'No class') === klass &&
        formatSelection(groupLabel(row.status, 'unset')) === status,
    )?.__count ?? 0

  const pivotRows: GroupedRow[] = rows.map((row) => ({
    rowKey: [groupLabel(row.class_id, 'No class')],
    colKey: formatSelection(groupLabel(row.status, 'unset')),
    value: row.__count,
    count: row.__count,
  }))

  return (
    <>
      <PageHeader
        title="Attendance analysis"
        subtitle="How many attendance records exist per class, and how they break down."
        breadcrumbs={[{ label: 'Attendance', href: '/attendance' }, { label: 'Analysis' }]}
        action={
          <Link
            href="/attendance"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Attendance list
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Records by class" hint="Stacked by status." />
          {classes.length === 0 ? (
            <EmptyState
              title="No attendance recorded"
              hint="Generate a roster from the attendance page to start recording."
            />
          ) : (
            <BarChart
              stacked
              categories={classes}
              caption="Attendance records per class, stacked by status."
              series={statuses.map((status) => ({
                label: status,
                values: classes.map((klass) => count(klass, status)),
              }))}
            />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="Class by status"
              hint="Counts of attendance records, not students."
            />
          </div>
          <PivotTable
            rows={pivotRows}
            rowHeaders={['Class']}
            columnHeader="All"
            emptyLabel="No attendance records are visible to your role yet."
          />
        </Card>
      </div>
    </>
  )
}
