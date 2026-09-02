import { redirect } from 'next/navigation'
import { Card, EmptyState, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { canCreateAssignment } from '@/lib/odoo/models/assignment'
import { AssignmentForm } from '../assignment-form'
import { loadAssignmentPickers } from '../pickers'

export const metadata = { title: 'New assignment · Async School' }

export default async function NewAssignmentPage() {
  let pickers, canCreate
  try {
    ;[pickers, canCreate] = await Promise.all([loadAssignmentPickers(), canCreateAssignment()])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New assignment" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/assignments" />
      </>
    )
  }

  if (!canCreate) redirect('/assignments')

  const missing =
    pickers.teachers.length === 0
      ? { what: 'teacher', href: '/teachers/new', label: 'Create a teaching profile' }
      : pickers.classes.length === 0
        ? { what: 'class', href: '/classes', label: 'View classes' }
        : pickers.terms.length === 0
          ? { what: 'term', href: '/configuration', label: 'Academic setup' }
          : null

  return (
    <>
      <PageHeader
        title="New assignment"
        subtitle="Ties a teacher to a subject, a class and a term. Odoo derives the academic year from the class."
        breadcrumbs={[{ label: 'Teaching assignments', href: '/assignments' }, { label: 'New' }]}
      />
      <Card className="max-w-4xl">
        {missing ? (
          <EmptyState
            icon="assignments"
            title={`No ${missing.what} is available yet`}
            hint={`An assignment needs a teacher, a class and a term. There is no ${missing.what} to choose.`}
            action={
              <LinkButton href={missing.href} variant="primary" size="sm">
                {missing.label}
              </LinkButton>
            }
          />
        ) : (
          <AssignmentForm
            mode="create"
            values={{
              teacher_id: '',
              class_id: '',
              subject_id: '',
              term_id: '',
              responsibility: 'teacher',
              teaching_role: 'lead',
              weekly_periods: '1',
              start_date: '',
              end_date: '',
            }}
            pickers={pickers}
          />
        )}
      </Card>
    </>
  )
}
