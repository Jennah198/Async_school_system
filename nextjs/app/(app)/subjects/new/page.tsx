import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { selectionOptions } from '@/lib/odoo/selections'
import { SubjectForm } from '../subject-form'

export const metadata = { title: 'New subject · Async School' }

export default async function NewSubjectPage() {
  let types, allowed
  try {
    ;[types, allowed] = await Promise.all([
      selectionOptions('school.subject', 'subject_type'),
      hasAccess('school.subject', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New subject" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/subjects" />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New subject" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create subjects. A registrar or administrator can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New subject"
        subtitle="Creating a subject does not put it on any class. That is set per class in the curriculum."
        breadcrumbs={[{ label: 'Subjects', href: '/subjects' }, { label: 'New' }]}
        action={
          <Link
            href="/subjects"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <SubjectForm
          mode="create"
          types={types}
          subject={{
            sequence_code: '',
            name: '',
            code: '',
            short_name: '',
            subject_type: 'compulsory',
            credit_hours: '1',
            active: true,
          }}
        />
      </Card>
    </>
  )
}
