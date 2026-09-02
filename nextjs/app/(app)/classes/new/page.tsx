import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { ClassForm } from '../class-form'
import { classPickers } from '../pickers'

export const metadata = { title: 'New class · Async School' }

export default async function NewClassPage() {
  let picked, allowed
  try {
    ;[picked, allowed] = await Promise.all([classPickers(), hasAccess('school.class', 'create')])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New class" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/classes" />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New class" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create classes. A registrar or administrator can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New class"
        subtitle="For the one-off class the year-setup wizard did not create. Odoo rejects a duplicate of an existing name, section and year."
        breadcrumbs={[{ label: 'Classes', href: '/classes' }, { label: 'New' }]}
        action={
          <Link
            href="/classes"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />
      <Card className="max-w-4xl">
        <ClassForm
          mode="create"
          klass={{
    name: "", grade_id: "", section_id: "", academic_year_id: "",
    education_level: "", capacity: "0", room_id: "", shift_id: "",
    stream_id: "", campus_id: "", homeroom_teacher_id: "",
    min_age: "0", max_age: "0", is_entry_level: false, active: true,
  }}
          pickers={picked.pickers}
          gradeLevels={picked.gradeLevels}
        />
      </Card>
    </>
  )
}
