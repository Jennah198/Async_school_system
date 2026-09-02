import Link from 'next/link'
import { formatDate, formatSelection } from '@/lib/format'
import { notFound } from 'next/navigation'
import {
  Badge,
  Card,
  CardHeader,
  Cell,
  DataTable,
  DetailField,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
  StatusBadge,
} from '@/components/ui'
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
import { DocumentUpload } from './document-upload'
import { GuardiansSection } from './guardian-form'
import { m2oLabel } from '@/lib/odoo/types'
import { selectionOptions } from '@/lib/odoo/selections'
import { availableTransitions } from '@/lib/odoo/workflows'

export const metadata = { title: 'Student · Async School' }


const Restricted = () => <span className="text-stone">Restricted to your role</span>

export default async function StudentDetailPage({ params }: PageProps<'/students/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let student, guardians, enrollments, personal, documents, canWrite, canWriteGuardians, relationships
  try {
    ;[student, guardians, enrollments, personal, documents, canWrite, canWriteGuardians, relationships] =
      await Promise.all([
        getStudent(id),
        listGuardians(id),
        listEnrollments({ studentId: id }),
        getStudentPersonalData(id),
        getStudentDocuments(id),
        hasAccess('school.student', 'write'),
        hasAccess('school.student.guardian', 'create'),
        selectionOptions('school.student.guardian', 'relationship'),
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

  return (
    <>
      <PageHeader
        title={student.name}
        subtitle={`${student.regno || 'No student ID yet'} · ${m2oLabel(student.class_id)}`}
        action={
          <Link
            href="/students"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Back to students
          </Link>
          // TODO(students): add a "Print" button here once wired, calling
          // school.student.action_print_student_report() — backend already
          // supports this, frontend just needs the trigger.
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Registration" />
            {/* TODO(students): registration form/detail is missing these
                fields that exist on the backend model: national_id,
                regional_id, place_of_birth, primary_language, email, photo,
                transfer_reference, support_need. Decide which belong here
                (read-only detail) vs. only on the create form. */}
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailField label="Student ID" value={student.regno || '—'} />
              <DetailField label="Admission number" value={student.admission_number || '—'} />
              <DetailField label="Admission type" value={formatSelection(student.admission_type)} />
              <DetailField label="Registered on" value={formatDate(student.registration_date)} />
              <DetailField label="Academic year" value={m2oLabel(student.academic_year_id)} />
              <DetailField label="Class" value={m2oLabel(student.class_id)} />
              <DetailField label="Section" value={m2oLabel(student.section_id)} />
              <DetailField label="Stream" value={m2oLabel(student.stream_id)} />
              <DetailField
                label="Education level"
                value={formatSelection(student.education_level)}
              />
              <DetailField label="Gender" value={formatSelection(student.gender)} />
              <DetailField
                label="Date of birth"
                value={personal ? personal.date_of_birth || '—' : <Restricted />}
              />
              <DetailField label="Age" value={personal ? personal.age : <Restricted />} />
              <DetailField
                label="FAN (National ID)"
                value={personal ? personal.fan_number || '—' : <Restricted />}
              />
              <DetailField label="Previous school" value={student.previous_school || '—'} />
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
                hint={`Intake contact: ${student.guardian_name || '—'} · ${student.guardian_phone || '—'}`}
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

          <Card>
            <CardHeader
              title="Registration documents"
              hint="Odoo requires the birth certificate before a registration can be submitted."
            />
            {/* TODO(students): only birth_certificate and previous_grade_document
                are handled here. Backend also has a dynamic document-rule system
                (school.document / school.document.rule) for additional required
                documents per grade/admission-type/stream — not shown anywhere yet.
                Also: workflows.ts already defines a `document` verify/reject
                workflow — check if/where that's meant to be used. */}
            {documents === null ? (
              <p className="text-[12px] text-slate">Not available to your role.</p>
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
              <DataTable columns={['Enrolment', 'Class', 'Year', 'Roll', 'From', 'Status']}>
                {enrollments.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>
                      <Link href={`/enrollments/${row.id}`} className="hover:text-action-blue">
                        {row.name}
                      </Link>
                    </Cell>
                    <Cell>{m2oLabel(row.class_id)}</Cell>
                    <Cell>{m2oLabel(row.academic_year_id)}</Cell>
                    <Cell numeric>{row.roll_number || '—'}</Cell>
                    <Cell>{formatDate(row.enrollment_date)}</Cell>
                    <Cell>
                      <StatusBadge state={row.state} />
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
            {/* TODO(students): transfer wizard (school.enrollment.transfer) and
                promotion wizard (school.promotion.wizard) should launch from
                the enrollment detail page (/enrollments/[id]), not here — but
                a "Transfer" / "Promote" action linking there could live in
                this card. */}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Registration status" />
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <StatusBadge state={status} model="school.student" />
              {!student.active ? <Badge tone="muted">Archived</Badge> : null}
            </div>
            <WorkflowPanel
              workflow="student"
              id={student.id}
              transitions={availableTransitions('student', status).map(
                ({ key, label, confirm, destructive, requiresReason }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={[`/students/${student.id}`, '/students']}
              canWrite={canWrite}
            />
            {/* TODO(students): registration questionnaire (school.registration.question
                / school.registration.answer) is required per grade/admission-type/
                stream and blocks submission if unanswered — not shown anywhere in
                the frontend yet. Needs its own section, probably here or on the
                create form. */}
            <p className="mt-4 border-t border-silver pt-3 text-[11px] text-stone">
              Odoo checks completeness on submit and approve — documents, questionnaire answers and
              the age-for-grade rule included — and names anything missing.
            </p>
          </Card>
        </div>
      </div>
    </>
  )
}