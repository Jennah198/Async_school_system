import Link from 'next/link'
import { formatSelection } from '@/lib/format'
import { notFound } from 'next/navigation'
import { Badge, Card, CardHeader, Cell, DataTable, DateText, DetailField, EmptyState, ErrorState, PageHeader, Row, StatusBadge } from '@/components/ui'
import { WorkflowPanel } from '@/components/workflow-panel'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  getStudent,
  getStudentDocuments,
  getStudentPersonalData,
  listEnrollments,
  listGuardians,
} from '@/lib/odoo/models/student'
import {
  listAnswers,
  listApplicableQuestions,
  listOptions,
} from '@/lib/odoo/models/registration'
import { DocumentUpload } from './document-upload'
import { Questionnaire } from './questionnaire'
import { GuardiansSection } from './guardian-form'
import { m2oId, m2oLabel } from '@/lib/odoo/types'
import { selectionOptions } from '@/lib/odoo/selections'
import { availableTransitions } from '@/lib/odoo/workflows'

export const metadata = { title: 'Student · Async School' }

const Restricted = () => (
  <span className="text-stone">Restricted to your role</span>
)

export default async function StudentDetailPage({
  params,
}: PageProps<'/students/[id]'>) {
  const id = Number((await params).id)

  if (!Number.isFinite(id)) notFound()

  let student,
    guardians,
    enrollments,
    personal,
    documents,
    canWrite,
    canWriteGuardians,
    relationships

  try {
    ;[
      student,
      guardians,
      enrollments,
      personal,
      documents,
      canWrite,
      canWriteGuardians,
      relationships,
    ] = await Promise.all([
      getStudent(id),
      listGuardians(id),
      listEnrollments({ studentId: id }),
      getStudentPersonalData(id),
      getStudentDocuments(id),
      hasAccess('school.student', 'write'),
      hasAccess('school.student.guardian', 'create'),
      selectionOptions(
        'school.student.guardian',
        'relationship',
      ),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Student" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!student) notFound()

  const status = String(student.registration_status || '')

  // The questionnaire is only meaningful before approval, and the domain that
  // decides which questions apply is the same one the submission check uses.
  const [applicable, answers] = await Promise.all([
    listApplicableQuestions({
      gradeLevel: Number(student.class_grade_level || 0),
      admissionType: String(student.admission_type || 'new'),
      streamId: m2oId(student.stream_id),
    }),
    listAnswers(student.id),
  ])

  const answerFor = new Map(
    (answers?.rows ?? []).map((row) => [m2oId(row.question_id) ?? 0, row]),
  )

  // Only selection questions need their choices fetched, and they are read in
  // parallel rather than one per row.
  const selectionRows = (applicable?.rows ?? []).filter(
    (question) => String(question.answer_type) === 'selection',
  )
  const optionPages = await Promise.all(
    selectionRows.map((question) => listOptions(question.id)),
  )
  const optionsFor = new Map(
    selectionRows.map((question, index) => [
      question.id,
      (optionPages[index]?.rows ?? []).map((option) => ({
        id: option.id,
        name: option.name,
      })),
    ]),
  )

  const questions = (applicable?.rows ?? []).map((question) => {
    const answer = answerFor.get(question.id)
    return {
      id: question.id,
      name: question.name,
      answerType: String(question.answer_type || 'text'),
      required: question.required,
      options: optionsFor.get(question.id) ?? [],
      answerId: answer?.id ?? null,
      valueText: String(answer?.value_text || ''),
      optionId: String(m2oId(answer?.option_id ?? false) ?? ''),
    }
  })

  return (
    <>
      <PageHeader
        title={student.name}
        subtitle={`${student.regno || 'No student ID yet'} · ${m2oLabel(
          student.class_id,
        )}`}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/api/students/${student.id}/report`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-[9999px] bg-black px-4 py-2 text-[13px] text-white hover:opacity-90"
            >
              Print
            </Link>

            {canWrite ? (
              <Link
                href={`/students/${student.id}/edit`}
                className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
              >
                Edit
              </Link>
            ) : null}

            <Link
              href="/students"
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Back to students
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Registration" />

            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailField
                label="Student ID"
                value={student.regno || '—'}
              />

              <DetailField
                label="Admission number"
                value={student.admission_number || '—'}
              />

              <DetailField
                label="Admission type"
                value={formatSelection(student.admission_type)}
              />

              <DetailField
                label="Registered on"
                value={<DateText value={student.registration_date} />}
              />

              <DetailField
                label="Academic year"
                value={m2oLabel(student.academic_year_id)}
              />

              <DetailField
                label="Class"
                value={m2oLabel(student.class_id)}
              />

              <DetailField
                label="Section"
                value={m2oLabel(student.section_id)}
              />

              <DetailField
                label="Stream"
                value={m2oLabel(student.stream_id)}
              />

              <DetailField
                label="Education level"
                value={formatSelection(student.education_level)}
              />

              <DetailField
                label="Gender"
                value={formatSelection(student.gender)}
              />

              <DetailField
                label="Date of birth"
                value={
                  personal ? (
                    personal.date_of_birth || '—'
                  ) : (
                    <Restricted />
                  )
                }
              />

              <DetailField
                label="Age"
                value={personal ? personal.age : <Restricted />}
              />

              <DetailField
                label="FAN"
                value={
                  personal ? (
                    personal.fan_number || '—'
                  ) : (
                    <Restricted />
                  )
                }
              />

              <DetailField
                label="National ID"
                value={student.national_id || '—'}
              />

              <DetailField
                label="Regional ID"
                value={student.regional_id || '—'}
              />

              <DetailField
                label="Place of birth"
                value={student.place_of_birth || '—'}
              />

              <DetailField
                label="Primary language"
                value={student.primary_language || '—'}
              />

              <DetailField
                label="Email"
                value={student.email || '—'}
              />

              <DetailField
                label="Previous school"
                value={student.previous_school || '—'}
              />

              <DetailField
                label="Transfer reference"
                value={student.transfer_reference || '—'}
              />

              <DetailField
                label="Support need"
                value={student.support_need ? 'Yes' : 'No'}
              />

              <DetailField
                label="Lifecycle"
                value={formatSelection(student.lifecycle_status)}
              />
            </dl>
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Guardians"
                hint="Odoo creates the partner-backed guardian link when the registration is approved."
              />
            </div>

            {guardians === null ? (
              <EmptyState title="Not available to your role" />
            ) : guardians.rows.length === 0 && !canWriteGuardians ? (
              <EmptyState
                title="No guardian linked yet"
                hint={`Intake contact: ${
                  student.guardian_name || '—'
                } · ${student.guardian_phone || '—'}`}
              />
            ) : (
              <div className="px-6 pb-6">
                <GuardiansSection
                  studentId={student.id}
                  guardians={guardians.rows}
                  relationships={relationships}
                  canWrite={canWriteGuardians}
                />
              </div>
            )}
          </Card>

          {questions.length > 0 ? (
            <Card padded={false}>
              <div className="p-6 pb-0">
                <CardHeader
                  title="Registration questionnaire"
                  hint="Odoo names every unanswered required question when a submission is refused."
                />
              </div>
              <Questionnaire
                studentId={student.id}
                questions={questions}
                canWrite={canWrite}
              />
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Registration documents"
              hint="Odoo requires the birth certificate before a registration can be submitted."
            />

            {documents === null ? (
              <p className="text-[12px] text-slate">
                Not available to your role.
              </p>
            ) : (
              <div>
                <DocumentUpload
                  studentId={student.id}
                  field="birth_certificate"
                  label="Birth certificate"
                  attached={documents.birth_certificate_filename}
                  hint="Required for every registration. PDF, JPG or PNG."
                  canWrite={canWrite}
                />

                <DocumentUpload
                  studentId={student.id}
                  field="previous_grade_document"
                  label="Previous grade document"
                  attached={documents.previous_grade_document_filename}
                  hint="Required unless the class is entry level."
                  canWrite={canWrite}
                />
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Enrolments"
                hint="One active enrolment per academic year, created on approval."
              />
            </div>

            {enrollments.rows.length === 0 ? (
              <EmptyState
                title="No enrolments yet"
                hint="Approving the registration creates and activates the first enrolment."
              />
            ) : (
              <DataTable
                columns={[
                  'Enrolment',
                  'Class',
                  'Year',
                  'Roll',
                  'From',
                  'Status',
                ]}
              >
                {enrollments.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>
                      <Link
                        href={`/enrollments/${row.id}`}
                        className="hover:text-action-blue"
                      >
                        {row.name}
                      </Link>
                    </Cell>

                    <Cell>{m2oLabel(row.class_id)}</Cell>

                    <Cell>
                      {m2oLabel(row.academic_year_id)}
                    </Cell>

                    <Cell numeric>
                      {row.roll_number || '—'}
                    </Cell>

                    <Cell>
                      <DateText value={row.enrollment_date} />
                    </Cell>

                    <Cell>
                      <StatusBadge state={row.state} />
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Registration status" />

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge
                state={status}
                model="school.student"
              />

              {!student.active ? (
                <Badge tone="muted">Archived</Badge>
              ) : null}
            </div>

            <WorkflowPanel
              workflow="student"
              id={student.id}
              transitions={availableTransitions(
                'student',
                status,
              ).map(
                ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={[
                `/students/${student.id}`,
                '/students',
              ]}
              canWrite={canWrite}
            />

            <p className="mt-4 border-t border-silver pt-3 text-[11px] text-stone">
              Odoo checks completeness on submit and approve —
              documents, questionnaire answers and the age-for-grade
              rule included — and names anything missing.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}