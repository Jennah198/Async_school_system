import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listPrograms } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Programs · Async School' }

const TONE = { published: 'live', completed: 'solid', cancelled: 'muted', draft: 'muted' } as const

export default function ProgramsPage() {
  return (
    <ResourceList
      title="Programs"
      subtitle="School events and activities, targeted the same way announcements are."
      load={() => listPrograms({ limit: 50 })}
      columns={['Program', 'Type', 'Audience', 'Starts', 'Ends', 'Location', 'Organiser', 'Status']}
      emptyTitle="No programs visible"
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/programs/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{String(row.program_type || '—').replace(/_/g, ' ')}</Cell>
          <Cell>{String(row.audience_type || '—').replace(/_/g, ' ')}</Cell>
          <Cell>{row.start_datetime}</Cell>
          <Cell>{row.end_datetime}</Cell>
          <Cell>{row.location || '—'}</Cell>
          <Cell>{m2oLabel(row.organizer_id)}</Cell>
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
