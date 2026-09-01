import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listStaff } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Staff · Async School' }

export default function StaffPage() {
  return (
    <ResourceList
      title="Staff"
      load={() => listStaff({ limit: 50 })}
      columns={['Name', 'Staff ID', 'Department', 'Job title', 'Responsibility', 'Status']}
      emptyTitle="No staff visible"
      emptyHint="Odoo scopes this list to the records your role may see."
      renderRow={(row) => (
        <>
          <Cell strong>{row.name}</Cell>
          <Cell>{row.staff_id || '—'}</Cell>
          <Cell>{String(row.department || '—')}</Cell>
          <Cell>{m2oLabel(row.job_title_id)}</Cell>
          <Cell>{String(row.primary_responsibility || '—').replace(/_/g, ' ')}</Cell>
          <Cell>
            <Badge tone={row.state === 'active' ? 'solid' : 'muted'}>
              {String(row.state || '—')}
            </Badge>
          </Cell>
        </>
      )}
    />
  )
}
