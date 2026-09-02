import { Card, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'

import { StaffImportForm } from './import-form'

export const metadata = { title: 'Import staff · Async School' }

export default async function StaffImportPage() {
  let allowed
  try {
    allowed = await hasAccess('school.staff', 'create')
  } catch (cause) {
    return (
      <>
        <PageHeader title="Import staff" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="Import staff" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create staff records. Importing also needs a system administrator."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Import staff"
        subtitle="Check a CSV against the live vocabularies, then create the rows it clears."
        action={
          <LinkButton href="/staff" icon="arrowLeft">
            Back to staff
          </LinkButton>
        }
      />

      <Card className="max-w-3xl">
        <StaffImportForm />
      </Card>
    </>
  )
}
