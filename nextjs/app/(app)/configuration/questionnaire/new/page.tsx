import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listConfig } from '@/lib/odoo/models/operations'
import { selectionOptions } from '@/lib/odoo/selections'
import { QuestionForm } from '../question-form'

export const metadata = { title: 'New question · Async School' }

export default async function NewQuestionPage() {
  let answerTypes, admissionTypes, streams, allowed
  try {
    ;[answerTypes, admissionTypes, streams, allowed] = await Promise.all([
      selectionOptions('school.registration.question', 'answer_type'),
      selectionOptions('school.registration.question', 'admission_type'),
      listConfig('streams'),
      hasAccess('school.registration.question', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New question" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration/questionnaire" />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New question" />
        <ErrorState
          code="FORBIDDEN"
          message="Only an administrator can change the registration questionnaire."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New question"
        subtitle="A required question blocks every registration it applies to until it is answered — so the grade range and admission type decide who is affected."
        breadcrumbs={[
          { label: 'Configuration', href: '/configuration' },
          { label: 'Questionnaire', href: '/configuration/questionnaire' },
          { label: 'New' },
        ]}
      />
      <Card className="max-w-3xl">
        <QuestionForm
          mode="create"
          answerTypes={answerTypes}
          admissionTypes={admissionTypes}
          streams={(streams?.rows ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
          question={{
            name: '', code: '', sequence: '10', answer_type: 'text',
            grade_from: '1', grade_to: '12', admission_type: 'all', stream_id: '',
            support_need_only: false, required: false, active: true,
          }}
        />
      </Card>
    </>
  )
}
