import { notFound, redirect } from 'next/navigation'
import { Card, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  audienceChoices,
  getAnnouncement,
  getAnnouncementAudience,
} from '@/lib/odoo/models/operations'
import { selectionOptions } from '@/lib/odoo/selections'
import { AnnouncementForm } from '../../announcement-form'

export const metadata = { title: 'Edit announcement · Async School' }

/** Odoo stores datetimes as "YYYY-MM-DD HH:MM:SS"; the form takes them apart. */
function splitDateTime(value: string | false): { date: string; time: string } {
  if (!value) return { date: '', time: '' }
  const [date, clock = ''] = String(value).split(' ')
  return { date, time: clock.slice(0, 5) }
}

/** Odoo's Html field comes back as markup; the textarea wants the text. */
function toPlainText(message: string | false): string {
  if (!message) return ''
  return String(message)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim()
}

export default async function EditAnnouncementPage({
  params,
}: PageProps<'/announcements/[id]/edit'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let item, audience, categories, priorities, audienceTypes, departments, responsibilities,
    audiences, canWrite
  try {
    ;[
      item, audience, categories, priorities, audienceTypes,
      departments, responsibilities, audiences, canWrite,
    ] = await Promise.all([
      getAnnouncement(id),
      getAnnouncementAudience(id),
      selectionOptions('school.announcement', 'category'),
      selectionOptions('school.announcement', 'priority'),
      selectionOptions('school.announcement', 'audience_type'),
      selectionOptions('school.announcement', 'department'),
      selectionOptions('school.announcement', 'responsibility'),
      audienceChoices(),
      hasAccess('school.announcement', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Edit announcement" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref={`/announcements/${id}`} />
      </>
    )
  }

  if (!item) notFound()
  if (!canWrite) redirect(`/announcements/${id}`)

  // Published and archived announcements have already had their recipients
  // resolved and stored, so the audience is no longer a live choice.
  const audienceLocked = String(item.state) !== 'draft'

  const publish = splitDateTime(item.publish_datetime)
  const expiry = splitDateTime(item.expiry_datetime)
  const audienceType = String(item.audience_type || 'all_staff')
  const recordIds =
    audience && audienceType in audience
      ? (audience[audienceType as keyof typeof audience] as number[] | undefined)
      : undefined

  return (
    <>
      <PageHeader
        title={`Edit ${item.name}`}
        subtitle={
          audienceLocked
            ? 'The recipients were resolved when this was published, so the audience is fixed. The message and schedule can still change.'
            : 'Still a draft, so everything including the audience can change.'
        }
        breadcrumbs={[
          { label: 'Announcements', href: '/announcements' },
          { label: item.name, href: `/announcements/${id}` },
          { label: 'Edit' },
        ]}
      />
      <Card className="max-w-3xl">
        <AnnouncementForm
          mode="edit"
          audienceLocked={audienceLocked}
          announcement={{
            id: item.id,
            name: item.name,
            message: toPlainText(item.message),
            category: String(item.category || 'general'),
            priority: String(item.priority || '0'),
            audience_type: audienceType,
            audience_code:
              audienceType === 'department'
                ? String(audience?.department || '')
                : audienceType === 'responsibility'
                  ? String(audience?.responsibility || '')
                  : '',
            audience_ids: (Array.isArray(recordIds) ? recordIds : []).map(String),
            publish_date: publish.date,
            publish_time: publish.time,
            expiry_date: expiry.date,
            expiry_time: expiry.time,
            link: String(item.link || ''),
          }}
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
