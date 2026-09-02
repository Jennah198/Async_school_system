import { PromoteForm } from './promote-form'
import { TransferForm } from './transfer-form'
import { OverrideSection } from './override-form'
import Link from 'next/link'
import { formatSelection } from '@/lib/format'
import { notFound } from 'next/navigation'
import { Card, CardHeader, Cell, DataTable, DateText, DetailField, EmptyState, ErrorState, PageHeader, Row, StatusBadge } from '@/components/ui'
import { WorkflowPanel } from '@/components/workflow-panel'
import { hasAccess } from '@/lib/odoo/client'
import { listAcademicYears } from '@/lib/odoo/models/school'
import { toOdooError } from '@/lib/odoo/errors'
import {
  getEnrollment,
  listOverrides,
  listPlacements,
  listPromotionTargets,
  listStudentSubjects,
} from '@/lib/odoo/models/student'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oId, m2oLabel } from '@/lib/odoo/types'
import { availableTransitions } from '@/lib/odoo/workflows'

export const metadata = { title: 'Enrolment · Async School' }


export default async function EnrollmentDetailPage({ params }: PageProps<'/enrollments/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let enrollment, subjects, placements, canWrite, years, targets, overrides,
    overrideOperations, canOverride
  try {
    ;[
      enrollment, subjects, placements, canWrite, years, targets, overrides,
      overrideOperations, canOverride,
    ] = await Promise.all([
      getEnrollment(id),
      listStudentSubjects(id),
      listPlacements(id),
      hasAccess('school.enrollment', 'write'),
      listAcademicYears({ limit: 50, order: 'date_start' }),
      listPromotionTargets(),
      listOverrides(id),
      selectionOptions('school.enrollment.override', 'operation'),
      hasAccess('school.enrollment.override', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Enrolment" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!enrollment) notFound()
  const state = String(enrollment.state || '')

  // A transfer stays inside the enrolment's own academic year — moving across
  // years is a promotion, which has its own form below.
  const yearId = m2oId(enrollment.academic_year_id)
  const transferTargets = targets.rows.filter(
    (row) => m2oId(row.academic_year_id) === yearId && row.id !== m2oId(enrollment.class_id),
  )

  return (
    <>
      <PageHeader
        title={enrollment.name}
        subtitle={`${m2oLabel(enrollment.student_id)} · ${m2oLabel(enrollment.class_id)}`}
        action={
          <Link
            href="/enrollments"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Back to enrolments
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Placement" />
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailField
                label="Student"
                value={
                  enrollment.student_id ? (
                    <Link
                      href={`/students/${enrollment.student_id[0]}`}
                      className="hover:text-action-blue"
                    >
                      {enrollment.student_id[1]}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailField label="Class" value={m2oLabel(enrollment.class_id)} />
              <DetailField label="Academic year" value={m2oLabel(enrollment.academic_year_id)} />
              <DetailField label="Roll number" value={enrollment.roll_number || '—'} />
              <DetailField label="Admission type" value={formatSelection(enrollment.admission_type)} />
              <DetailField label="Enrolled on" value={<DateText value={enrollment.enrollment_date} />} />
              <DetailField label="Ended on" value={<DateText value={enrollment.end_date} />} />
            </dl>
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Subjects"
                hint="Derived by Odoo from the class curriculum when the enrolment is activated."
              />
            </div>
            {subjects === null ? (
              <EmptyState title="Not available to your role" />
            ) : subjects.rows.length === 0 ? (
              <EmptyState
                title="No subjects yet"
                hint="Activating the enrolment derives the compulsory subjects."
              />
            ) : (
              <DataTable columns={['Subject', 'Type', 'From', 'To', 'Status']}>
                {subjects.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{m2oLabel(row.subject_id)}</Cell>
                    <Cell>{formatSelection(row.subject_type)}</Cell>
                    <Cell>{<DateText value={row.date_start} />}</Cell>
                    <Cell>{<DateText value={row.date_end} />}</Cell>
                    <Cell>
                      <StatusBadge state={row.state} />
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Placement history"
                hint="Effective-dated. Attendance is anchored to the placement in force on each date."
              />
            </div>
            {placements === null ? (
              <EmptyState title="Not available to your role" />
            ) : placements.rows.length === 0 ? (
              <EmptyState title="No placement recorded" />
            ) : (
              <DataTable columns={['Class', 'Shift', 'Stream', 'Roll', 'From', 'To']}>
                {placements.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{m2oLabel(row.class_id)}</Cell>
                    <Cell>{m2oLabel(row.shift_id)}</Cell>
                    <Cell>{m2oLabel(row.stream_id)}</Cell>
                    <Cell numeric>{row.roll_number || '—'}</Cell>
                    <Cell>{<DateText value={row.date_start} />}</Cell>
                    <Cell>{row.date_end || 'Current'}</Cell>
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
              workflow="enrollment"
              id={enrollment.id}
              transitions={availableTransitions('enrollment', state).map(
                ({ key, label, confirm, destructive, requiresReason }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={[`/enrollments/${enrollment.id}`, '/enrollments']}
              canWrite={canWrite}
            />
            {canWrite && state === 'active' ? (
              <div className="mt-3">
                <PromoteForm
                  enrollmentId={enrollment.id}
                  years={years.rows.map((year) => ({ id: year.id, name: year.name }))}
                  classes={targets.rows.map((row) => ({
                    id: row.id,
                    name: m2oLabel(row.academic_year_id) + ' · ' + row.name,
                    yearId: m2oId(row.academic_year_id),
                  }))}
                />
              </div>
            ) : null}
            {canWrite && state === 'active' ? (
              <div className="mt-3 border-t border-silver pt-3">
                <TransferForm
                  enrollmentId={enrollment.id}
                  currentClass={m2oLabel(enrollment.class_id)}
                  classes={transferTargets.map((row) => ({
                    id: row.id,
                    name: row.name,
                    full: false,
                  }))}
                />
              </div>
            ) : null}
            <p className="mt-4 border-t border-silver pt-3 text-[11px] text-stone">
              Activation checks class capacity, allocates the roll number, records the placement and
              derives the subjects — all inside Odoo.
            </p>
          </Card>

          {overrides === null ? null : (
            <Card padded={false}>
              <div className="p-6 pb-0">
                <CardHeader
                  title="Authorised overrides"
                  hint="Permanent approvals that let this enrolment pass a rule it would otherwise fail."
                />
              </div>
              <OverrideSection
                enrollmentId={enrollment.id}
                canAuthorize={canOverride}
                operations={overrideOperations}
                overrides={overrides.rows.map((row) => ({
                  id: row.id,
                  operation: formatSelection(row.operation),
                  reason: row.reason,
                  approvedBy: m2oLabel(row.approved_by_id),
                  approvedAt: row.approved_at,
                  active: row.active,
                }))}
              />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
