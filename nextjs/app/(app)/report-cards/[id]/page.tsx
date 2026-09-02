import { notFound } from 'next/navigation'
import { formatSelection } from '@/lib/format'
import {
  Card,
  CardHeader,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { WorkflowDetail } from '@/components/workflow-detail'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getReportCard, listReportCardLines } from '@/lib/odoo/models/assessment'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Report card · Async School' }

const num = (value: number | undefined, digits = 1) =>
  typeof value === 'number' ? value.toFixed(digits) : '—'

export default async function ReportCardDetailPage({ params }: PageProps<'/report-cards/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let card, lines, canWrite
  try {
    ;[card, lines, canWrite] = await Promise.all([
      getReportCard(id),
      listReportCardLines(id),
      hasAccess('school.report.card', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Report card" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }
  if (!card) notFound()

  return (
    <WorkflowDetail
      title={card.name}
      subtitle={`${m2oLabel(card.student_id)} · ${m2oLabel(card.term_id)}`}
      backHref="/report-cards"
      backLabel="Back to report cards"
      workflow="reportCard"
      id={card.id}
      state={String(card.state || '')}
      canWrite={canWrite}
      revalidate={[`/report-cards/${card.id}`, '/report-cards']}
      note="Every figure here is Odoo's, computed from published marks and the configured grading scheme."
      fields={[
        { label: 'Student', value: m2oLabel(card.student_id) },
        { label: 'Class', value: m2oLabel(card.class_id) },
        { label: 'Term', value: m2oLabel(card.term_id) },
        { label: 'Overall percentage', value: num(card.overall_percentage, 2) },
        { label: 'Overall grade', value: card.overall_grade || '—' },
        { label: 'Result', value: formatSelection(card.result_status) },
        { label: 'Class rank', value: card.class_rank || '—' },
        { label: 'Present', value: card.attendance_present ?? '—' },
        { label: 'Absent', value: card.attendance_absent ?? '—' },
        { label: 'Attendance %', value: num(card.attendance_percentage) },
        { label: 'Promotion decision', value: formatSelection(card.promotion_decision) },
        { label: 'Published at', value: card.published_at || '—' },
      ]}
    >
      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader title="Subject results" hint="Computed by Odoo — never recalculated here." />
        </div>
        {lines === null ? (
          <EmptyState title="Not available to your role" />
        ) : lines.rows.length === 0 ? (
          <EmptyState title="No subject lines" hint="Generate the report card to populate them." />
        ) : (
          <DataTable columns={['Subject', 'Score', 'Out of', 'Percent', 'Grade']}>
            {lines.rows.map((line) => (
              <Row key={line.id}>
                <Cell strong>{m2oLabel(line.subject_id)}</Cell>
                <Cell numeric>{line.score}</Cell>
                <Cell numeric>{line.maximum}</Cell>
                <Cell numeric>{num(line.percentage)}</Cell>
                <Cell>{line.grade || '—'}</Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Card>
    </WorkflowDetail>
  )
}
