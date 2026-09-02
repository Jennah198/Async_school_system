import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getSubject } from '@/lib/odoo/models/school'
import { selectionOptions } from '@/lib/odoo/selections'
import { SubjectForm } from '../../subject-form'

export const metadata = { title: 'Edit subject · Async School' }

export default async function EditSubjectPage({ params }: PageProps<'/subjects/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let subject, types, canWrite
  try {
    ;[subject, types, canWrite] = await Promise.all([
      getSubject(id),
      selectionOptions('school.subject', 'subject_type'),
      hasAccess('school.subject', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit subject" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/subjects" />
      </>
    )
  }

  if (!subject) notFound()
  if (!canWrite) redirect('/subjects')

  return (
    <>
      <PageHeader
        title={`Edit ${subject.name}`}
        subtitle="Archiving a subject leaves it on the curricula that already reference it — Odoo keeps the history."
        breadcrumbs={[{ label: 'Subjects', href: '/subjects' }, { label: subject.name }]}
      />
      <Card className="max-w-2xl">
        <SubjectForm
          mode="edit"
          types={types}
          subject={{
            id: subject.id,
            sequence_code: String(subject.sequence_code || ''),
            name: subject.name,
            code: String(subject.code || ''),
            short_name: String(subject.short_name || ''),
            subject_type: String(subject.subject_type || ''),
            credit_hours: String(subject.credit_hours ?? 0),
            active: subject.active,
          }}
        />
      </Card>
    </>
  )
}
