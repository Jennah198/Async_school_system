import { Badge } from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { Cell, ResourceList } from '@/components/resource-list'
import { listSubjects } from '@/lib/odoo/models/school'

export const metadata = { title: 'Subjects · Async School' }

export default function SubjectsPage() {
  return (
    <ResourceList
      title="Subjects"
      load={() => listSubjects({ limit: 100 })}
      columns={['Subject', 'Code', 'Type', 'State']}
      emptyTitle="No subjects visible"
      renderRow={(row) => (
        <>
          <Cell strong>{row.name}</Cell>
          <Cell>{row.code || '—'}</Cell>
          <Cell>{formatSelection(row.subject_type)}</Cell>
          <Cell>
            <Badge tone={row.active ? 'neutral' : 'muted'}>
              {row.active ? 'Active' : 'Archived'}
            </Badge>
          </Cell>
        </>
      )}
    />
  )
}
