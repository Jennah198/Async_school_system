import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { formatSelection } from '@/lib/format'
import { getAssessment } from '@/lib/odoo/models/assessment'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oLabel } from '@/lib/odoo/types'
import { AssessmentEditForm } from './assessment-edit-form'

export const metadata = { title: 'Edit assessment · Async School' }

export default async function EditAssessmentPage({
  params,
}: PageProps<'/assessments/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let assessment, types, canWrite
  try {
    ;[assessment, types, canWrite] = await Promise.all([
      getAssessment(id),
      selectionOptions('school.assessment', 'assessment_type'),
      hasAccess('school.assessment', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit assessment" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/assessments/${id}`} />
      </>
    )
  }

  if (!assessment) notFound()
  if (!canWrite) redirect(`/assessments/${id}`)

  // Odoo's own rule: setup is frozen the moment the record leaves draft,
  // because the mark list was generated against it.
  const setupFrozen = String(assessment.state) !== 'draft'

  return (
    <>
      <PageHeader
        title={`Edit ${assessment.name}`}
        subtitle={
          setupFrozen
            ? 'The mark list exists, so only the name can change.'
            : 'Still in draft, so the whole setup is editable.'
        }
        breadcrumbs={[
          { label: 'Assessments', href: '/assessments' },
          { label: assessment.name, href: `/assessments/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-3xl">
        <AssessmentEditForm
          types={types}
          setupFrozen={setupFrozen}
          assessment={{
            id: assessment.id,
            name: assessment.name,
            assessment_type: setupFrozen
              ? formatSelection(assessment.assessment_type)
              : String(assessment.assessment_type || ''),
            date: String(assessment.date || ''),
            max_mark: String(assessment.max_mark ?? ''),
            weight: String(assessment.weight ?? ''),
            className: m2oLabel(assessment.class_id),
            subject: m2oLabel(assessment.subject_id),
            term: m2oLabel(assessment.term_id),
            markCount: assessment.mark_count ?? 0,
          }}
        />
      </Card>
    </>
  )
}
