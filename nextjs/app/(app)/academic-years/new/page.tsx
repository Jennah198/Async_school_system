import { Card, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { AcademicYearForm } from './academic-year-form'

export const metadata = { title: 'New academic year · Async School' }

export default async function NewAcademicYearPage() {
  let allowed
  try {
    allowed = await hasAccess('school.academic.year', 'create')
  } catch (cause) {
    return (
      <>
        <PageHeader title="New academic year" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New academic year" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create academic years. A registrar or administrator can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New academic year"
        subtitle="Pick the dates in the Ethiopian calendar. The year opens in draft."
        action={
          <LinkButton href="/academic-years" icon="arrowLeft">
            Cancel
          </LinkButton>
        }
      />

      <Card className="max-w-3xl">
        <AcademicYearForm />
      </Card>
    </>
  )
}
