import { notFound } from 'next/navigation'
import { Badge, Card, CardHeader, Cell, DataTable, DateText, DetailGrid, EmptyState, ErrorState, LinkButton, Note, PageHeader, Row, RowLink, StatusBadge, TableCard } from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { formatEthiopianDateRange, formatSelection, trimNumber } from '@/lib/format'
import {
  assignmentTransitionsFrom,
  canWriteAssignment,
  getAssignment,
  listClassTermAssignments,
} from '@/lib/odoo/models/assignment'
import { m2oId, m2oLabel } from '@/lib/odoo/types'
import { AssignmentActions } from './assignment-actions'

export const metadata = { title: 'Assignment · Async School' }

/**
 * One assignment, with every relationship named rather than numbered.
 *
 * The panel of other assignments for the same class and term is the context
 * Odoo's `_check_single_teacher_per_subject_class_term` operates on: it is what
 * makes "Grade 8A already has somebody teaching Mathematics this term"
 * understandable before the constraint fires rather than after.
 */
export default async function AssignmentDetailPage({ params }: PageProps<'/assignments/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let assignment, canWrite
  try {
    ;[assignment, canWrite] = await Promise.all([getAssignment(id), canWriteAssignment()])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Assignment" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/assignments" />
      </>
    )
  }
  if (!assignment) notFound()

  const classId = m2oId(assignment.class_id)
  const termId = m2oId(assignment.term_id)
  const teacherId = m2oId(assignment.teacher_id)
  const siblings =
    classId && termId ? await listClassTermAssignments(classId, termId, id) : null

  const state = String(assignment.state || '')

  return (
    <>
      <PageHeader
        title={`${m2oLabel(assignment.subject_id)} · ${m2oLabel(assignment.class_id)}`}
        subtitle={`${m2oLabel(assignment.teacher_id)} — ${m2oLabel(assignment.term_id)}, ${m2oLabel(assignment.academic_year_id)}`}
        breadcrumbs={[
          { label: 'Teaching assignments', href: '/assignments' },
          { label: m2oLabel(assignment.subject_id) },
        ]}
        meta={
          <>
            <StatusBadge state={state} />
            {assignment.responsibility === 'homeroom' ? (
              <Badge tone="solid">Homeroom</Badge>
            ) : null}
            {assignment.active ? null : <Badge tone="muted">Archived</Badge>}
          </>
        }
        action={
          <>
            {canWrite ? (
              <LinkButton href={`/assignments/${id}/edit`} icon="assignments" variant="primary">
                Edit
              </LinkButton>
            ) : null}
            <LinkButton href="/assignments" icon="arrowLeft">
              Back
            </LinkButton>
          </>
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Assignment" icon="assignments" />
            <DetailGrid
              fields={[
                {
                  label: 'Teacher',
                  value: teacherId ? (
                    <RowLink href={`/teachers/${teacherId}`}>{m2oLabel(assignment.teacher_id)}</RowLink>
                  ) : (
                    '—'
                  ),
                },
                { label: 'Subject', value: m2oLabel(assignment.subject_id) },
                { label: 'Class', value: m2oLabel(assignment.class_id) },
                { label: 'Term', value: m2oLabel(assignment.term_id) },
                {
                  label: 'Academic year',
                  value: m2oLabel(assignment.academic_year_id),
                },
                { label: 'Responsibility', value: formatSelection(assignment.responsibility) },
                { label: 'Teaching role', value: formatSelection(assignment.teaching_role) },
                { label: 'Periods per week', value: trimNumber(assignment.weekly_periods) },
                {
                  label: 'Effective',
                  value: formatEthiopianDateRange(assignment.start_date, assignment.end_date),
                },
                { label: 'Starts', value: <DateText value={assignment.start_date} /> },
                { label: 'Ends', value: assignment.end_date ? <DateText value={assignment.end_date} /> : 'Open' },
              ]}
            />
            <Note>
              The academic year is not chosen — Odoo relates it from the class, so a class and its
              assignments can never disagree about which year they are in.
            </Note>
          </Card>

          <TableCard
            title="Others teaching this class this term"
            icon="teachers"
            hint="Odoo allows one active teacher per subject, class and term. This is what a clash would be against."
          >
            {siblings === null ? (
              <EmptyState icon="teachers" title="Not available to your role" />
            ) : siblings.rows.length === 0 ? (
              <EmptyState
                icon="teachers"
                title="No other active assignments"
                hint="Nobody else is teaching this class this term."
              />
            ) : (
              <DataTable
                caption="Other active assignments for this class and term"
                columns={[
                  { key: 'subject', label: 'Subject' },
                  { key: 'teacher', label: 'Teacher' },
                  { key: 'role', label: 'Responsibility', hideBelow: 'sm' },
                  { key: 'periods', label: 'Periods', numeric: true },
                ]}
              >
                {siblings.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>
                      <RowLink href={`/assignments/${row.id}`}>{m2oLabel(row.subject_id)}</RowLink>
                    </Cell>
                    <Cell>{m2oLabel(row.teacher_id)}</Cell>
                    <Cell hideBelow="sm">{formatSelection(row.responsibility)}</Cell>
                    <Cell numeric>{row.weekly_periods}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </TableCard>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" icon="check" />
            <div className="mb-4">
              <StatusBadge state={state} />
            </div>
            <AssignmentActions
              assignmentId={id}
              transitions={assignmentTransitionsFrom(state)}
              canWrite={canWrite}
            />
            <Note>
              This model has no Odoo action methods — its state is a field. The transitions offered
              here come from a server-side table; the browser posts a key, never a field or a value.
              Ending and cancelling keep the record: Odoo refuses to delete assignment history.
            </Note>
          </Card>
        </div>
      </div>
    </>
  )
}
