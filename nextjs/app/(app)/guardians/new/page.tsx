import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess, callKw } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listStudents } from '@/lib/odoo/models/school'
import { GuardianForm } from './guardian-form'

export const metadata = { title: 'Add guardian · Async School' }

interface FieldMeta {
  selection?: Array<[string, string]>
}

export default async function NewGuardianPage() {
  let students, meta, allowed

  try {
    ;[students, meta, allowed] = await Promise.all([
      listStudents({ limit: 200, order: 'name asc' }),
      callKw<Record<string, FieldMeta>>('school.student.guardian', 'fields_get', [], {
        attributes: ['selection'],
      }),
      hasAccess('school.student.guardian', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Add guardian" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Add guardian" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot add guardians. A registrar or administrator can."
        />
      </>
    )
  }

  const relationships = (meta.relationship?.selection ?? []).map(([value, label]) => ({
    value,
    label,
  }))

  return (
    <>
      <PageHeader
        title="Add guardian"
        subtitle="Add a guardian relationship to an existing student."
        action={
          <Link
            href="/guardians"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />

      <Card className="max-w-3xl">
        <GuardianForm
          students={students.rows.map((student) => ({
            id: student.id,
            name: student.name,
            regno: student.regno,
          }))}
          relationships={relationships}
        />
      </Card>
    </>
  )
}