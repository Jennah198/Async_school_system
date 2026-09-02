import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getClass } from '@/lib/odoo/models/school'
import { m2oId } from '@/lib/odoo/types'
import { ClassForm } from '../../class-form'
import { classPickers } from '../../pickers'

export const metadata = { title: 'Edit class · Async School' }

export default async function EditClassPage({ params }: PageProps<'/classes/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let klass, picked, canWrite
  try {
    ;[klass, picked, canWrite] = await Promise.all([
      getClass(id),
      classPickers(),
      hasAccess('school.class', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit class" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/classes/${id}`} />
      </>
    )
  }

  if (!klass) notFound()
  if (!canWrite) redirect(`/classes/${id}`)

  return (
    <>
      <PageHeader
        title={`Edit ${klass.name}`}
        subtitle="Changing the name, section or academic year is checked against every other class for a duplicate."
        breadcrumbs={[
          { label: 'Classes', href: '/classes' },
          { label: klass.name, href: `/classes/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-4xl">
        <ClassForm
          mode="edit"
          klass={{
            id: klass.id,
            name: klass.name,
            grade_id: String(m2oId(klass.grade_id) ?? ''),
            section_id: String(m2oId(klass.section_id) ?? ''),
            academic_year_id: String(m2oId(klass.academic_year_id) ?? ''),
            education_level: String(klass.education_level || ''),
            capacity: String(klass.capacity ?? 0),
            room_id: String(m2oId(klass.room_id) ?? ''),
            shift_id: String(m2oId(klass.shift_id) ?? ''),
            stream_id: String(m2oId(klass.stream_id) ?? ''),
            campus_id: String(m2oId(klass.campus_id) ?? ''),
            homeroom_teacher_id: String(m2oId(klass.homeroom_teacher_id) ?? ''),
            min_age: String(klass.min_age ?? 0),
            max_age: String(klass.max_age ?? 0),
            is_entry_level: klass.is_entry_level,
            active: klass.active,
          }}
          pickers={picked.pickers}
          gradeLevels={picked.gradeLevels}
        />
      </Card>
    </>
  )
}
