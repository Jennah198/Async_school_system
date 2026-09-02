import Link from 'next/link'
import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { BarChart } from '@/components/ui/bar-chart'
import { PivotTable } from '@/components/ui/pivot-table'
import { toOdooError } from '@/lib/odoo/errors'
import { aggregate, groupLabel, MARK_MEASURE } from '@/lib/odoo/models/analytics'
import type { GroupedRow } from '@/lib/pivot'

export const metadata = { title: 'Results analysis - Async School' }

/**
 * Odoo's `school.mark.graph` and `school.mark.pivot`, as this app renders them.
 *
 * Both read through `read_group`, so the record rules scope them exactly as
 * they scope the mark list: a teacher sees their own classes here, a director
 * sees the school, and neither query mentions the difference.
 *
 * The measure is averaged, not summed. Odoo's graph sums it because
 * `percentage` declares no aggregator, but a total of percentages is not a
 * quantity anyone can act on.
 */
export default async function MarksAnalysisPage() {
  let bySubjectTerm, byClassSubjectTerm
  try {
    ;[bySubjectTerm, byClassSubjectTerm] = await Promise.all([
      aggregate('school.mark', {
        measures: [MARK_MEASURE],
        groupby: ['subject_id', 'term_id'],
      }),
      aggregate('school.mark', {
        measures: [MARK_MEASURE],
        groupby: ['class_id', 'subject_id', 'term_id'],
      }),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Results analysis" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/marks" />
      </>
    )
  }

  const graphRows = bySubjectTerm ?? []
  const subjects: string[] = []
  const terms: string[] = []
  for (const row of graphRows) {
    const subject = groupLabel(row.subject_id, 'No subject')
    const term = groupLabel(row.term_id, 'No term')
    if (!subjects.includes(subject)) subjects.push(subject)
    if (!terms.includes(term)) terms.push(term)
  }

  const average = (subject: string, term: string) => {
    const row = graphRows.find(
      (item) =>
        groupLabel(item.subject_id, 'No subject') === subject &&
        groupLabel(item.term_id, 'No term') === term,
    )
    if (!row || !row.__count) return 0
    return Math.round((Number(row[MARK_MEASURE] ?? 0) / row.__count) * 10) / 10
  }

  const pivotRows: GroupedRow[] = (byClassSubjectTerm ?? []).map((row) => ({
    rowKey: [groupLabel(row.class_id, 'No class'), groupLabel(row.subject_id, 'No subject')],
    colKey: groupLabel(row.term_id, 'No term'),
    value: Number(row[MARK_MEASURE] ?? 0),
    count: row.__count,
  }))

  return (
    <>
      <PageHeader
        title="Results analysis"
        subtitle="Average percentage across recorded marks. Scoped to whatever your role may read."
        breadcrumbs={[{ label: 'Marks', href: '/marks' }, { label: 'Analysis' }]}
        action={
          <Link
            href="/marks"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Mark list
          </Link>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Average by subject" hint="Each term shown separately." />
          {subjects.length === 0 ? (
            <EmptyState
              title="No marks recorded"
              hint="Averages appear once an assessment has marks against it."
            />
          ) : (
            <BarChart
              categories={subjects}
              valueSuffix="%"
              caption="Average percentage per subject, split by term."
              series={terms.map((term) => ({
                label: term,
                values: subjects.map((subject) => average(subject, term)),
              }))}
            />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-6 pb-4">
            <CardHeader
              title="Class and subject by term"
              hint="Averages, not totals - a summed percentage means nothing."
            />
          </div>
          <PivotTable
            rows={pivotRows}
            rowHeaders={['Class', 'Subject']}
            columnHeader="All terms"
            average
            suffix="%"
            emptyLabel="No marks are visible to your role yet."
          />
        </Card>
      </div>
    </>
  )
}
