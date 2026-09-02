import Link from 'next/link'
import { formatDateTime, formatSelection } from '@/lib/format'
import {
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listPrograms } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Programs · Async School' }


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
          <Cell>{formatSelection(row.program_type)}</Cell>
          <Cell>{formatSelection(row.audience_type)}</Cell>
          <Cell>{formatDateTime(row.start_datetime)}</Cell>
          <Cell>{formatDateTime(row.end_datetime)}</Cell>
          <Cell>{row.location || '—'}</Cell>
          <Cell>{m2oLabel(row.organizer_id)}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
