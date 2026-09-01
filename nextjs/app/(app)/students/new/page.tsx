import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listClassScopes } from '@/lib/odoo/models/student'
import { callKw } from '@/lib/odoo/client'
import { StudentRegistrationForm } from './student-form'

export const metadata = { title: 'Register student · Async School' }

interface FieldMeta {
  selection?: Array<[string, string]>
}

export default async function NewStudentPage() {
  let classes, meta, allowed
  try {
    ;[classes, meta, allowed] = await Promise.all([
      listClassScopes(),
      callKw<Record<string, FieldMeta>>('school.student', 'fields_get', [], {
        attributes: ['selection'],
      }),
      hasAccess('school.student', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Register student" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Register student" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot register students. A registrar or administrator can."
        />
      </>
    )
  }

  const options = (field: string) =>
    (meta[field]?.selection ?? []).map(([value, label]) => ({ value, label }))

  return (
    <>
      <PageHeader
        title="Register student"
        subtitle="Created in Draft. Odoo checks completeness — documents, questionnaire, age for grade — when the registration is submitted."
        action={
          <Link
            href="/students"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <StudentRegistrationForm
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            year: c.academic_year_id ? c.academic_year_id[1] : '—',
            level: String(c.education_level || ''),
            entryLevel: c.is_entry_level,
          }))}
          genders={options('gender')}
          admissionTypes={options('admission_type')}
          // Odoo omits fields the caller cannot access, so its presence in
          // fields_get is the permission check.
          canSeeFan={Object.prototype.hasOwnProperty.call(meta, 'fan_number')}
        />
      </Card>
    </>
  )
}
