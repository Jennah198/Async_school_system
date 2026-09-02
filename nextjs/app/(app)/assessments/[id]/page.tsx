import Link from 'next/link'
import { formatDualDate, formatSelection } from '@/lib/format'
import { notFound } from 'next/navigation'
import { Card, CardHeader, Cell, DataTable, DateText, DetailField, EmptyState, ErrorState, PageHeader, Row, StatusBadge } from '@/components/ui'
import { WorkflowPanel } from '@/components/workflow-panel'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { UNLOCKABLE_STATES, getAssessment, listAssessmentEvents, listAssessmentMarks, markStatusOptions } from '@/lib/odoo/models/assessment'
import { m2oLabel } from '@/lib/odoo/types'
import { availableTransitions } from '@/lib/odoo/workflows'
import { MarkList } from './mark-list'
import { UnlockForm } from './unlock-form'

export const metadata = { title: 'Assessment · Async School' }


export default async function AssessmentDetailPage({ params }: PageProps<'/assessments/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let assessment, marks, events, statuses, canWrite
  try {
    ;[assessment, marks, events, statuses, canWrite] = await Promise.all([
      getAssessment(id),
      listAssessmentMarks(id),
      listAssessmentEvents(id),
      markStatusOptions(),
      hasAccess('school.mark', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Assessment" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!assessment) notFound()
  const state = String(assessment.state || '')
  // Mirrors school.mark.write: entry is only accepted while draft or open.
  const entryOpen = state === 'draft' || state === 'open'

  return (
    <>
      <PageHeader
        title={assessment.name}
        subtitle={`${m2oLabel(assessment.class_id)} · ${m2oLabel(assessment.subject_id)} · ${formatDualDate(assessment.date)}`}
        action={
          <Link
            href="/assessments"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Back to assessments
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Setup" hint="Frozen by Odoo once the mark list exists." />
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailField label="Type" value={formatSelection(assessment.assessment_type)} />
              <DetailField label="Class" value={m2oLabel(assessment.class_id)} />
              <DetailField label="Subject" value={m2oLabel(assessment.subject_id)} />
              <DetailField label="Term" value={m2oLabel(assessment.term_id)} />
              <DetailField label="Academic year" value={m2oLabel(assessment.academic_year_id)} />
              <DetailField label="Date" value={<DateText value={assessment.date} />} />
              <DetailField label="Maximum mark" value={assessment.max_mark} />
              <DetailField label="Weight" value={assessment.weight} />
              <DetailField
                label="Teacher assignment"
                value={m2oLabel(assessment.teacher_assignment_id)}
              />
            </dl>
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Mark list"
                hint={
                  entryOpen
                    ? 'Percentages and grades are computed by Odoo as you save.'
                    : 'Entry is closed at this stage. Odoo reopens it through the unlock workflow.'
                }
              />
            </div>
            {marks.rows.length === 0 ? (
              <EmptyState
                title="No mark rows yet"
                hint="Opening the assessment generates the roster from subject enrolments valid on the assessment date."
              />
            ) : (
              <MarkList
                assessmentId={assessment.id}
                rows={marks.rows.map((row) => ({
                  id: row.id,
                  student: m2oLabel(row.student_id),
                  score: row.score,
                  maxScore: row.max_score,
                  percentage: row.percentage,
                  grade: row.grade,
                  status: String(row.mark_status || ''),
                  note: row.note || '',
                }))}
                statusOptions={statuses}
                editable={entryOpen && canWrite}
              />
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Audit trail"
                hint="Immutable — Odoo refuses to edit or delete these events."
              />
            </div>
            {events === null ? (
              <EmptyState title="Not available to your role" />
            ) : events.rows.length === 0 ? (
              <EmptyState title="No events recorded yet" />
            ) : (
              <DataTable columns={['Event', 'By', 'When', 'Reason']}>
                {events.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{formatSelection(row.event_type)}</Cell>
                    <Cell>{m2oLabel(row.actor_id)}</Cell>
                    <Cell>{<DateText value={row.occurred_at} withTime />}</Cell>
                    <Cell>{row.reason || '—'}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <div className="mb-4">
              <StatusBadge state={state} />
            </div>
            <WorkflowPanel
              workflow="assessment"
              id={assessment.id}
              transitions={availableTransitions('assessment', state).map(
                ({ key, label, confirm, destructive, requiresReason }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={[`/assessments/${assessment.id}`, '/assessments', '/marks']}
              canWrite={canWrite}
            />
            {canWrite && UNLOCKABLE_STATES.has(state) ? (
              <div className="mt-3">
                <UnlockForm assessmentId={assessment.id} />
              </div>
            ) : null}
            <p className="mt-4 border-t border-silver pt-3 text-[11px] text-stone">
              Approve, lock, publish and return are Exam Officer actions — Odoo re-checks that on
              every call, including a direct field write.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}
