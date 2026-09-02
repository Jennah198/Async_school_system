import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { editableNameParts } from '@/lib/name-parts'
import {
  getStudent,
  getStudentPersonalData,
  studentFieldMeta,
  type StudentFieldMeta,
} from '@/lib/odoo/models/student'
import { StudentEditForm } from './student-edit-form'

export const metadata = { title: 'Edit student · Async School' }

/**
 * Which inputs this page offers is Odoo's decision.
 *
 * `fields_get` runs as the signed-in user and omits anything behind a group
 * they lack, so a role without the registrar groups gets no FAN, national ID
 * or regional ID input at all rather than one whose write would be refused.
 */
const CANDIDATES = [
  'first_name', 'middle_name', 'last_name', 'gender', 'date_of_birth',
  'place_of_birth', 'primary_language', 'email',
  'fan_number', 'national_id', 'regional_id',
  'guardian_name', 'guardian_phone', 'guardian_relationship', 'guardian_occupation',
  'emergency_contact_name', 'emergency_contact_phone',
  'admission_type', 'previous_school', 'transfer_reference',
  'registration_date', 'support_need',
]

const options = (meta: Record<string, StudentFieldMeta>, field: string) =>
  meta[field]?.selection ?? []

export default async function EditStudentPage({ params }: PageProps<'/students/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let student, personal, meta, canWrite
  try {
    ;[student, personal, meta, canWrite] = await Promise.all([
      getStudent(id),
      getStudentPersonalData(id),
      studentFieldMeta(),
      hasAccess('school.student', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit student" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/students/${id}`} />
      </>
    )
  }

  if (!student) notFound()
  // Odoo would refuse the write anyway; sending the user back is kinder than
  // rendering a form that cannot be submitted.
  if (!canWrite) redirect(`/students/${id}`)

  const editable = CANDIDATES.filter(
    (field) =>
      Object.prototype.hasOwnProperty.call(meta, field) && !meta[field].readonly,
  )

  // Stored parts are used only when they still rebuild the stored name; both
  // registration and the demo seed leave records where they do not.
  const parts = editableNameParts(String(student.name || ''), {
    first: String(student.first_name || ''),
    middle: String(student.middle_name || ''),
    last: String(student.last_name || ''),
  })

  return (
    <>
      <PageHeader
        title={`Edit ${student.name}`}
        subtitle="Odoo validates every change — the FAN, the phone numbers, and the minimum age for the class the student sits in."
        breadcrumbs={[
          { label: 'Students', href: '/students' },
          { label: student.name, href: `/students/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-4xl">
        <StudentEditForm
          student={{
            id: student.id,
            name: student.name,
            regno: String(student.regno || ''),
            first_name: parts.first,
            middle_name: parts.middle,
            last_name: parts.last,
            gender: String(student.gender || ''),
            date_of_birth: String(personal?.date_of_birth || ''),
            place_of_birth: String(student.place_of_birth || ''),
            primary_language: String(student.primary_language || ''),
            email: String(student.email || ''),
            fan_number: String(personal?.fan_number || ''),
            national_id: String(personal?.national_id || ''),
            regional_id: String(personal?.regional_id || ''),
            guardian_name: String(student.guardian_name || ''),
            guardian_phone: String(student.guardian_phone || ''),
            guardian_relationship: String(student.guardian_relationship || ''),
            guardian_occupation: String(student.guardian_occupation || ''),
            emergency_contact_name: String(student.emergency_contact_name || ''),
            emergency_contact_phone: String(student.emergency_contact_phone || ''),
            admission_type: String(student.admission_type || ''),
            previous_school: String(student.previous_school || ''),
            transfer_reference: String(student.transfer_reference || ''),
            registration_date: String(student.registration_date || ''),
            support_need: student.support_need,
          }}
          genders={options(meta, 'gender')}
          admissionTypes={options(meta, 'admission_type')}
          relationships={options(meta, 'guardian_relationship')}
          editable={editable}
        />
      </Card>
    </>
  )
}
