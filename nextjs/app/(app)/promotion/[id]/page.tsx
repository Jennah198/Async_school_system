import { notFound } from 'next/navigation'
import {
  Badge,
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
import { getPromotionBatch, listPromotionLines } from '@/lib/odoo/models/assessment'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Promotion batch · Async School' }

export default async function PromotionDetailPage({ params }: PageProps<'/promotion/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let batch, lines, canWrite
  try {
    ;[batch, lines, canWrite] = await Promise.all([
      getPromotionBatch(id),
      listPromotionLines(id),
      hasAccess('school.promotion.batch', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Promotion batch" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }
  if (!batch) notFound()

  return (
    <WorkflowDetail
      title={batch.name}
      subtitle={`${m2oLabel(batch.academic_year_id)} to ${m2oLabel(batch.target_academic_year_id)}`}
      backHref="/promotion"
      backLabel="Back to promotion"
      workflow="promotion"
      id={batch.id}
      state={String(batch.state || '')}
      canWrite={canWrite}
      revalidate={[`/promotion/${batch.id}`, '/promotion', '/enrollments']}
      note="Applying the batch advances every enrolment in it. Odoo calculates each outcome from published results."
      fields={[
        { label: 'From year', value: m2oLabel(batch.academic_year_id) },
        { label: 'To year', value: m2oLabel(batch.target_academic_year_id) },
        { label: 'Grade', value: m2oLabel(batch.grade_id) },
        { label: 'Minimum pass average', value: batch.minimum_pass_average },
        { label: 'Max failed subjects', value: batch.max_failed_subjects },
        { label: 'Students', value: batch.line_count },
        { label: 'Promoted', value: batch.promoted_count },
        { label: 'Retained', value: batch.retained_count },
        { label: 'Graduated', value: batch.graduated_count },
        { label: 'Conditional', value: batch.conditional_count },
      ]}
    >
      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader
            title="Outcomes"
            hint="Calculated by Odoo from each annual average, against this batch's thresholds."
          />
        </div>
        {lines === null ? (
          <EmptyState title="Not available to your role" />
        ) : lines.rows.length === 0 ? (
          <EmptyState title="No outcomes yet" hint="Run Calculate outcomes to populate them." />
        ) : (
          <DataTable
            head={['Student', 'Student ID', 'Current class', 'Average', 'Calculated', 'Final', 'Target class']}
          >
            {lines.rows.map((line) => (
              <Row key={line.id}>
                <Cell strong>{m2oLabel(line.student_id)}</Cell>
                <Cell>{line.regno || '—'}</Cell>
                <Cell>{m2oLabel(line.current_class_id)}</Cell>
                <Cell numeric>
                  {typeof line.annual_average === 'number' ? line.annual_average.toFixed(2) : '—'}
                </Cell>
                <Cell>{String(line.calculated_outcome || '—')}</Cell>
                <Cell>
                  <Badge tone={line.is_overridden ? 'live' : 'neutral'}>
                    {String(line.final_outcome || '—')}
                  </Badge>
                </Cell>
                <Cell>{m2oLabel(line.target_class_id)}</Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Card>
    </WorkflowDetail>
  )
}
