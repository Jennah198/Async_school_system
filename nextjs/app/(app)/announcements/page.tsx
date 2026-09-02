import Link from 'next/link'
import { formatDateTime, formatSelection } from '@/lib/format'
import {
  Badge,
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listAnnouncements } from '@/lib/odoo/models/operations'

export const metadata = { title: 'Announcements · Async School' }

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
          <Cell>{formatSelection(row.category)}</Cell>
          <Cell>{formatSelection(row.audience_type)}</Cell>
          <Cell>{PRIORITY[String(row.priority) as keyof typeof PRIORITY] ?? '—'}</Cell>
          <Cell>{formatDateTime(row.publish_datetime)}</Cell>
          <Cell>{formatDateTime(row.expiry_datetime)}</Cell>
          <Cell>{row.is_live ? <Badge tone="live">Live</Badge> : null}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
