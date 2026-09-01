import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listAnnouncements } from '@/lib/odoo/models/operations'

export const metadata = { title: 'Announcements · Async School' }

const TONE = { published: 'live', archived: 'muted', draft: 'muted' } as const
const PRIORITY = { '0': 'Normal', '1': 'Important', '2': 'Urgent' } as const

export default function AnnouncementsPage() {
  return (
    <ResourceList
      title="Announcements"
      subtitle="Odoo resolves the audience and refreshes visibility on a schedule."
      load={() => listAnnouncements({ limit: 50 })}
      columns={['Title', 'Category', 'Audience', 'Priority', 'Publish', 'Expires', 'Live', 'Status']}
      emptyTitle="No announcements visible"
      emptyHint="You see the ones you authored and the ones addressed to you."
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/announcements/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{String(row.category || '—').replace(/_/g, ' ')}</Cell>
          <Cell>{String(row.audience_type || '—').replace(/_/g, ' ')}</Cell>
          <Cell>{PRIORITY[String(row.priority) as keyof typeof PRIORITY] ?? '—'}</Cell>
          <Cell>{row.publish_datetime || '—'}</Cell>
          <Cell>{row.expiry_datetime || '—'}</Cell>
          <Cell>{row.is_live ? <Badge tone="live">Live</Badge> : null}</Cell>
          <Cell>
            <Badge tone={TONE[row.state as keyof typeof TONE] ?? 'neutral'}>
              {String(row.state || '—')}
            </Badge>
          </Cell>
        </>
      )}
    />
  )
}
