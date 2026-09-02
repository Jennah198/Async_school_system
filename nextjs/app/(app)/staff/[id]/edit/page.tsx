import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  canUse,
  getStaff,
  getStaffPersonalData,
  listCampusOptions,
  listJobTitles,
  listManagerOptions,
  staffFieldMeta,
} from '@/lib/odoo/models/staff'
import { m2oId } from '@/lib/odoo/types'
import { StaffEditForm } from './staff-edit-form'

export const metadata = { title: 'Edit staff · Async School' }

/**
 * Which fields this page offers is Odoo's decision.
 *
 * `fields_get` runs as the signed-in user and omits anything they may not
 * access, so a role without the personal-data groups gets no date-of-birth
 * input at all rather than one whose write would be refused. Computed and
 * readonly fields are dropped for the same reason.
 */
function editableFields(meta: Awaited<ReturnType<typeof staffFieldMeta>>): string[] {
  const candidates = [
    'first_name', 'last_name', 'gender', 'date_of_birth', 'fayda_id',
    'phone', 'mobile', 'email', 'department', 'job_title_id',
    'employment_type', 'employment_status', 'hire_date', 'end_date',
    'campus_id', 'manager_id',
  ]
  return candidates.filter((field) => canUse(meta, field) && !meta[field].readonly)
}

const options = (meta: Awaited<ReturnType<typeof staffFieldMeta>>, field: string) =>
  meta[field]?.selection ?? []

export default async function EditStaffPage({ params }: PageProps<'/staff/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let staff, meta, personal, jobTitles, campuses, managers, canWrite
  try {
    ;[staff, meta, personal, jobTitles, campuses, managers, canWrite] = await Promise.all([
      getStaff(id),
      staffFieldMeta(),
      getStaffPersonalData(id),
      listJobTitles(),
      listCampusOptions(),
      listManagerOptions(id),
      hasAccess('school.staff', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit staff" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/staff/${id}`} />
      </>
    )
  }

  if (!staff) notFound()
  // Odoo would refuse the write anyway; sending the user back is kinder than
  // rendering a form that cannot be submitted.
  if (!canWrite) redirect(`/staff/${id}`)

  const editable = editableFields(meta)

  return (
    <>
      <PageHeader
        title={`Edit ${staff.name}`}
        subtitle="Odoo validates every change — the Fayda ID, the phone, the job title against its department, and the fields required to leave Draft."
        breadcrumbs={[
          { label: 'Staff', href: '/staff' },
          { label: staff.name, href: `/staff/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-4xl">
        <StaffEditForm
          staff={{
            id: staff.id,
            name: staff.name,
            staff_id: String(staff.staff_id || ''),
            first_name: String(staff.first_name || ''),
            last_name: String(staff.last_name || ''),
            gender: String(staff.gender || ''),
            date_of_birth: String(personal?.date_of_birth || ''),
            fayda_id: String(personal?.fayda_id || ''),
            phone: String(staff.phone || ''),
            mobile: String(staff.mobile || ''),
            email: String(staff.email || ''),
            department: String(staff.department || ''),
            job_title_id: String(m2oId(staff.job_title_id) ?? ''),
            employment_type: String(staff.employment_type || ''),
            employment_status: String(staff.employment_status || ''),
            hire_date: String(staff.hire_date || ''),
            end_date: String(staff.end_date || ''),
            campus_id: String(m2oId(staff.campus_id) ?? ''),
            manager_id: String(m2oId(staff.manager_id) ?? ''),
          }}
          jobTitles={jobTitles.map((title) => ({
            id: title.id,
            name: title.name,
            department: String(title.department || ''),
            responsibility: String(title.responsibility || ''),
          }))}
          departments={options(meta, 'department')}
          genders={options(meta, 'gender')}
          employmentTypes={options(meta, 'employment_type')}
          employmentStatuses={options(meta, 'employment_status')}
          campuses={campuses}
          managers={managers}
          editable={editable}
        />
      </Card>
    </>
  )
}
