import { Card, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listAssignmentOptions } from '@/lib/odoo/models/assessment'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oLabel } from '@/lib/odoo/types'

import { AssessmentForm } from './assessment-form'

export const metadata = { title: 'New assessment · Async School' }

export default async function NewAssessmentPage() {
  let assignments, types, allowed
  try {
    ;[assignments, types, allowed] = await Promise.all([
      listAssignmentOptions(),
      selectionOptions('school.assessment', 'assessment_type'),
      hasAccess('school.assessment', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New assessment" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New assessment" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create assessments. A teacher, exam officer or registrar can."
        />
      </>
    )
  }

  const choices = assignments.rows.map((row) => ({
    id: row.id,
    label: `${m2oLabel(row.class_id)} · ${m2oLabel(row.subject_id)} — ${m2oLabel(
      row.teacher_id,
    )} (${m2oLabel(row.term_id)})`,
    startDate: row.start_date,
    endDate: row.end_date,
  }))

  if (choices.length === 0) {
    return (
      <>
        <PageHeader title="New assessment" />
        <ErrorState
          code="NO_ASSIGNMENTS"
          message="No active teaching assignment is visible to you, and an assessment must name one. A registrar creates assignments."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New assessment"
        subtitle="Created in draft. Opening it afterwards generates the mark list."
        action={
          <LinkButton href="/assessments" icon="arrowLeft">
            Cancel
          </LinkButton>
        }
      />

      <Card className="max-w-3xl">
        <AssessmentForm assignments={choices} types={types} />
      </Card>
    </>
  )
}
