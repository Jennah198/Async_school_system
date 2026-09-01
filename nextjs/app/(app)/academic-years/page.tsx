import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listAcademicYears } from '@/lib/odoo/models/school'

export const metadata = { title: 'Academic years · Async School' }

/** Years are named by the Ethiopian year of their Gregorian start date. */
export default function AcademicYearsPage() {
  return (
    <ResourceList
      title="Academic years"
      subtitle="Named by the Ethiopian year of the start date, as Odoo validates it."
      load={listAcademicYears}
      columns={['Year', 'Starts', 'Ends', 'Classes', 'Status', 'Default for new records']}
      emptyTitle="No academic years visible"
      renderRow={(row) => (
        <>
          <Cell strong>{row.name}</Cell>
          <Cell>{row.date_start}</Cell>
          <Cell>{row.date_end}</Cell>
          <Cell numeric>{row.class_count}</Cell>
          <Cell>
            <Badge tone={row.state === 'open' ? 'solid' : 'muted'}>
              {String(row.state || '—')}
            </Badge>
          </Cell>
          <Cell>{row.is_current ? <Badge tone="live">Current</Badge> : null}</Cell>
        </>
      )}
    />
  )
}
