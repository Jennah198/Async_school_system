import { notFound } from 'next/navigation'
import { Card, CardHeader, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getQuestion, listOptions } from '@/lib/odoo/models/registration'
import { listConfig } from '@/lib/odoo/models/operations'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oId } from '@/lib/odoo/types'
import { QuestionForm } from '../question-form'
import { QuestionOptions } from './options'

export const metadata = { title: 'Question · Async School' }

export default async function QuestionPage({
  params,
}: PageProps<'/configuration/questionnaire/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let question, options, answerTypes, admissionTypes, streams, canWrite
  try {
    ;[question, options, answerTypes, admissionTypes, streams, canWrite] = await Promise.all([
      getQuestion(id),
      listOptions(id),
      selectionOptions('school.registration.question', 'answer_type'),
      selectionOptions('school.registration.question', 'admission_type'),
      listConfig('streams'),
      hasAccess('school.registration.question', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Question" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration/questionnaire" />
      </>
    )
  }

  if (!question) notFound()

  return (
    <>
      <PageHeader
        title={question.name}
        subtitle={`Asked of grades ${question.grade_from}–${question.grade_to}${
          question.required ? ' · blocks submission until answered' : ' · optional'
        }`}
        breadcrumbs={[
          { label: 'Configuration', href: '/configuration' },
          { label: 'Questionnaire', href: '/configuration/questionnaire' },
          { label: question.name },
        ]}
      />

      <div className="space-y-4">
        <Card className="max-w-3xl">
          <QuestionForm
            mode="edit"
            answerTypes={answerTypes}
            admissionTypes={admissionTypes}
            streams={(streams?.rows ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
            question={{
              id: question.id,
              name: question.name,
              code: question.code,
              sequence: String(question.sequence ?? 10),
              answer_type: String(question.answer_type || 'text'),
              grade_from: String(question.grade_from ?? 1),
              grade_to: String(question.grade_to ?? 12),
              admission_type: String(question.admission_type || 'all'),
              stream_id: String(m2oId(question.stream_id) ?? ''),
              support_need_only: question.support_need_only,
              required: question.required,
              active: question.active,
            }}
          />
        </Card>

        {String(question.answer_type) === 'selection' ? (
          <Card padded={false} className="max-w-3xl">
            <div className="p-6 pb-0">
              <CardHeader
                title="Choices"
                hint="What the answer is picked from. The stored value is what gets recorded."
              />
            </div>
            <QuestionOptions
              questionId={question.id}
              options={(options?.rows ?? []).map((o) => ({
                id: o.id,
                name: o.name,
                value: o.value,
                sequence: o.sequence,
              }))}
              canWrite={canWrite && options !== null}
            />
          </Card>
        ) : null}
      </div>
    </>
  )
}
