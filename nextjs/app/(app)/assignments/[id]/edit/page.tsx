import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { canWriteAssignment, getAssignment } from '@/lib/odoo/models/assignment'
import { m2oId, m2oLabel } from '@/lib/odoo/types'
import { AssignmentForm } from '../../assignment-form'
import { loadAssignmentPickers } from '../../pickers'

export const metadata = { title: 'Edit assignment · Async School' }

export default async function EditAssignmentPage({ params }: PageProps<'/assignments/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let assignment, pickers, canWrite
  try {
    ;[assignment, pickers, canWrite] = await Promise.all([
      getAssignment(id),
      loadAssignmentPickers(),
      canWriteAssignment(),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit assignment" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/assignments/${id}`} />
      </>
    )
  }

  if (!assignment) notFound()
  if (!canWrite) redirect(`/assignments/${id}`)

  return (
    <>
      <PageHeader
        title={`Edit ${m2oLabel(assignment.subject_id)} · ${m2oLabel(assignment.class_id)}`}
        subtitle="Odoo re-runs every constraint on save, including the single-teacher and workload rules."
        breadcrumbs={[
          { label: 'Teaching assignments', href: '/assignments' },
          { label: m2oLabel(assignment.subject_id), href: `/assignments/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-4xl">
        <AssignmentForm
          mode="edit"
          values={{
            id: assignment.id,
            teacher_id: String(m2oId(assignment.teacher_id) ?? ''),
            class_id: String(m2oId(assignment.class_id) ?? ''),
            subject_id: String(m2oId(assignment.subject_id) ?? ''),
            term_id: String(m2oId(assignment.term_id) ?? ''),
            responsibility: String(assignment.responsibility || ''),
            teaching_role: String(assignment.teaching_role || ''),
            weekly_periods: String(assignment.weekly_periods ?? 1),
            start_date: String(assignment.start_date || ''),
            end_date: String(assignment.end_date || ''),
          }}
          pickers={pickers}
        />
      </Card>
    </>
  )
}
