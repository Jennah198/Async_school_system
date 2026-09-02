import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge, DateText, ErrorState, PageHeader } from '@/components/ui'
import { YearCorrectionForm } from './correction-form'
import { WorkflowDetail } from '@/components/workflow-detail'
import { formatCount, formatEthiopianDateRange } from '@/lib/format'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getAcademicYear } from '@/lib/odoo/models/school'

/** Odoo's write refuses every field but state, is_current and active on these. */
const LOCKED_STATES = ['closed', 'archived']

export const metadata = { title: 'Academic year · Async School' }

/**
 * A year is named by the Ethiopian year of its Gregorian start date — Odoo
 * validates that agreement, so the name is shown as the title and the dates
 * carry both calendars beneath it.
 */
export default async function AcademicYearDetailPage({
  params,
}: PageProps<'/academic-years/[id]'>) {
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
        <PageHeader title="Academic year" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }
  if (!year) notFound()

  return (
    <WorkflowDetail
      title={year.name}
      subtitle={formatEthiopianDateRange(year.date_start, year.date_end)}
      backHref="/academic-years"
      backLabel="Back to academic years"
      workflow="academicYear"
      id={year.id}
      state={String(year.state || '')}
      canWrite={canWrite}
      revalidate={[`/academic-years/${year.id}`, '/academic-years']}
      meta={year.is_current ? <Badge tone="live">Current</Badge> : undefined}
      note="Closing a year makes it read-only. Creating the next year copies nothing — it opens an empty year to build classes in."
      actions={
        canWrite ? (
          LOCKED_STATES.includes(String(year.state)) ? (
            <YearCorrectionForm
              yearId={year.id}
              name={year.name}
              dateStart={year.date_start}
              dateEnd={year.date_end}
            />
          ) : (
            <Link
              href={`/academic-years/${year.id}/edit`}
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Edit dates
            </Link>
          )
        ) : undefined
      }
      fields={[
        { label: 'Name', value: year.name },
        { label: 'Starts', value: <DateText value={year.date_start} /> },
        { label: 'Ends', value: <DateText value={year.date_end} /> },
        { label: 'Classes', value: formatCount(year.class_count) },
        {
          label: 'Default for new records',
          value: year.is_current ? 'Yes' : 'No',
        },
      ]}
    />
  )
}
