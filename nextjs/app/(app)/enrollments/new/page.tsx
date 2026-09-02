import Link from 'next/link'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { classOptions } from '@/lib/odoo/filter-options'
import { selectionOptions } from '@/lib/odoo/selections'
import { EnrollmentForm } from './enrollment-form'

export const metadata = { title: 'New enrolment · Async School' }

export default async function NewEnrollmentPage() {
  let classes, admissionTypes, allowed
  try {
    ;[classes, admissionTypes, allowed] = await Promise.all([
      classOptions(),
      selectionOptions('school.enrollment', 'admission_type'),
      hasAccess('school.enrollment', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New enrolment" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New enrolment" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot create enrolments. A registrar or administrator can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New enrolment"
        subtitle="For returning or re-admitted students already in the system. New and transfer admissions register through Students → Register."
        action={
          <Link
            href="/enrollments"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Cancel
          </Link>
        }
      />
      <Card className="max-w-2xl">
        <EnrollmentForm classes={classes} admissionTypes={admissionTypes} />
      </Card>
    </>
  )
}