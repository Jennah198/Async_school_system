import { notFound } from 'next/navigation'
import { formatSelection } from '@/lib/format'
import { Card, CardHeader, ErrorState, PageHeader } from '@/components/ui'
import { WorkflowDetail } from '@/components/workflow-detail'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getAnnouncement } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Announcement · Async School' }

export default async function AnnouncementDetailPage({ params }: PageProps<'/announcements/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let item, canWrite
  try {
    ;[item, canWrite] = await Promise.all([
      getAnnouncement(id),
      hasAccess('school.announcement', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Announcement" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }
  if (!item) notFound()

  return (
    <WorkflowDetail
      title={item.name}
      subtitle={`${String(item.category || '')} · ${formatSelection(item.audience_type)}`}
      backHref="/announcements"
      backLabel="Back to announcements"
      workflow="announcement"
      id={item.id}
      state={String(item.state || '')}
      canWrite={canWrite}
      revalidate={[`/announcements/${item.id}`, '/announcements']}
      note="Only published announcements inside their publication window reach their audience. A scheduled job refreshes that."
      fields={[
        { label: 'Category', value: formatSelection(item.category) },
        { label: 'Audience', value: formatSelection(item.audience_type) },
        { label: 'Author', value: m2oLabel(item.author_id) },
        { label: 'Publishes', value: item.publish_datetime || '—' },
        { label: 'Expires', value: item.expiry_datetime || '—' },
        { label: 'Live now', value: item.is_live ? 'Yes' : 'No' },
        { label: 'Link', value: item.link || '—' },
      ]}
    >
      <Card>
        <CardHeader title="Message" />
        {/* Odoo sanitises Html fields on write; rendered as text here rather
            than injected, because the frontend is not the sanitiser. */}
        <p className="text-[13px] whitespace-pre-wrap text-graphite">
          {String(item.message || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '—'}
        </p>
      </Card>
    </WorkflowDetail>
  )
}
