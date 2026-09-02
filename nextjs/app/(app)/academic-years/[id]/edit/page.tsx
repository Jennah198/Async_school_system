import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getAcademicYear } from '@/lib/odoo/models/school'
import { AcademicYearForm } from '../../academic-year-form'

export const metadata = { title: 'Edit academic year · Async School' }

/** Odoo's `write` makes these read-only for everything but state and flags. */
const LOCKED_STATES = ['closed', 'archived']

export default async function EditAcademicYearPage({
  params,
}: PageProps<'/academic-years/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let year, canWrite
  try {
    ;[year, canWrite] = await Promise.all([
      getAcademicYear(id),
      hasAccess('school.academic.year', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit academic year" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/academic-years/${id}`} />
      </>
    )
  }

  if (!year) notFound()
  if (!canWrite) redirect(`/academic-years/${id}`)
  // A closed year is corrected through the authorized workflow on its own
  // page, not here — sending the user there beats a form Odoo would refuse.
  if (LOCKED_STATES.includes(String(year.state))) redirect(`/academic-years/${id}`)

  return (
    <>
      <PageHeader
        title={`Edit ${year.name}`}
        subtitle="Moving the start date renames the year — Odoo requires the name to be the Ethiopian year the start date falls in."
        breadcrumbs={[
          { label: 'Academic years', href: '/academic-years' },
          { label: year.name, href: `/academic-years/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-2xl">
        <AcademicYearForm
          mode="edit"
          year={{
            id: year.id,
            date_start: year.date_start,
            date_end: year.date_end,
            is_current: year.is_current,
          }}
        />
      </Card>
    </>
  )
}
