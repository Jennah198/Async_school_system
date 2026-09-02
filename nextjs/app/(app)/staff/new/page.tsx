import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { hasAccess } from '@/lib/odoo/client'
import { canUse, listJobTitles, staffFieldMeta } from '@/lib/odoo/models/staff'
import { StaffRegistrationForm } from './staff-form'

export const metadata = { title: 'Register staff · Async School' }

/**
 * The form is built from Odoo's own `fields_get`, so a role that cannot write
 * `date_of_birth` or `fayda_id` is never shown those inputs — the field list
 * Odoo returns is the permission check.
 */
export default async function NewStaffPage() {
  let meta, jobTitles, allowed
  try {
    ;[meta, jobTitles, allowed] = await Promise.all([
      staffFieldMeta(),
      listJobTitles(),
      hasAccess('school.staff', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Register staff" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Register staff" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create staff records. A registrar or administrator can."
        />
      </>
    )
  }

  const selection = (field: string) => meta[field]?.selection ?? []

  return (
    <>
      <PageHeader
        title="Register staff"
        subtitle="The record is created in Draft. Odoo will not let it leave Draft until every required detail is present."
        action={
          <Link
            href="/staff"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />
      <Card className="max-w-3xl">
        <StaffRegistrationForm
          jobTitles={jobTitles.map((t) => ({
            id: t.id,
            name: t.name,
            department: String(t.department || ''),
            responsibility: String(t.responsibility || ''),
          }))}
          departments={selection('department')}
          genders={selection('gender')}
          employmentTypes={selection('employment_type')}
          employmentStatuses={selection('employment_status')}
          responsibilities={selection('primary_responsibility')}
          canSeePersonalData={canUse(meta, 'date_of_birth')}
          canSeeFayda={canUse(meta, 'fayda_id')}
        />
      </Card>
    </>
  )
}
