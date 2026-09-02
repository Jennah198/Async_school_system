import { Card, ErrorState, LinkButton, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { audienceChoices } from '@/lib/odoo/models/operations'
import { selectionOptions } from '@/lib/odoo/selections'

import { AnnouncementForm } from '../announcement-form'

export const metadata = { title: 'New announcement · Async School' }

export default async function NewAnnouncementPage() {
  let categories, priorities, audienceTypes, departments, responsibilities, audiences, allowed

  try {
    ;[
      categories,
      priorities,
      audienceTypes,
      departments,
      responsibilities,
      audiences,
      allowed,
    ] = await Promise.all([
      selectionOptions('school.announcement', 'category'),
      selectionOptions('school.announcement', 'priority'),
      selectionOptions('school.announcement', 'audience_type'),
      selectionOptions('school.announcement', 'department'),
      selectionOptions('school.announcement', 'responsibility'),
      audienceChoices(),
      hasAccess('school.announcement', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="New announcement" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!allowed) {
    return (
      <>
        <PageHeader title="New announcement" />
        <ErrorState
          code="FORBIDDEN"
          message="Your role cannot write announcements. A registrar, front office or administrator can."
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="New announcement"
        subtitle="Saved as a draft. Publishing resolves the audience and starts the visibility window."
        action={
          <LinkButton href="/announcements" icon="arrowLeft">
            Cancel
          </LinkButton>
        }
      />

      <Card className="max-w-3xl">
        <AnnouncementForm
          categories={categories}
          priorities={priorities}
          audienceTypes={audienceTypes}
          departments={departments}
          responsibilities={responsibilities}
          audiences={audiences}
        />
      </Card>
    </>
  )
}
