import Link from 'next/link'
import {
  Badge, Card, CardHeader, Cell, DataTable, EmptyState, ErrorState, PageHeader, Row,
} from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listQuestions } from '@/lib/odoo/models/registration'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Registration questionnaire · Async School' }

export default async function QuestionnairePage() {
  let questions, canCreate
  try {
    ;[questions, canCreate] = await Promise.all([
      listQuestions(),
      hasAccess('school.registration.question', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Registration questionnaire" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration" />
      </>
    )
  }

  const required = (questions?.rows ?? []).filter((q) => q.required && q.active).length

  return (
    <>
      <PageHeader
        title="Registration questionnaire"
        subtitle="Odoo refuses to submit a registration while any applicable required question is unanswered, and names each one."
        breadcrumbs={[
          { label: 'Configuration', href: '/configuration' },
          { label: 'Questionnaire' },
        ]}
        action={
          canCreate ? (
            <Link
              href="/configuration/questionnaire/new"
              className="rounded-[9999px] bg-ink px-4 py-2 text-[13px] text-white hover:bg-graphite"
            >
              New question
            </Link>
          ) : null
        }
      />

      {questions === null ? (
        <Card>
          <EmptyState title="Not available to your role" />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="p-6 pb-0">
            <CardHeader
              title="Questions"
              hint={
                required === 0
                  ? 'Nothing is required, so the questionnaire never blocks a submission.'
                  : `${required} required question${required === 1 ? '' : 's'} must be answered before a registration can be submitted.`
              }
            />
          </div>
          {questions.rows.length === 0 ? (
            <EmptyState
              title="No questions yet"
              hint="Registrations submit freely until a required question exists."
            />
          ) : (
            <DataTable columns={['Question', 'Type', 'Grades', 'Admission', 'Stream', 'Status']}>
              {questions.rows.map((question) => (
                <Row key={question.id}>
                  <Cell strong>
                    <Link
                      href={`/configuration/questionnaire/${question.id}`}
                      className="hover:text-action-blue"
                    >
                      {question.name}
                    </Link>
                  </Cell>
                  <Cell>{formatSelection(question.answer_type)}</Cell>
                  <Cell numeric>
                    {question.grade_from}–{question.grade_to}
                  </Cell>
                  <Cell>{formatSelection(question.admission_type)}</Cell>
                  <Cell>{m2oLabel(question.stream_id)}</Cell>
                  <Cell>
                    <div className="flex flex-wrap gap-1.5">
                      {question.required ? <Badge tone="solid">Required</Badge> : null}
                      {question.active ? null : <Badge tone="muted">Retired</Badge>}
                    </div>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Card>
      )}
    </>
  )
}
