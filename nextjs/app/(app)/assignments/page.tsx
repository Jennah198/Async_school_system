import {
  StatusBadge,
} from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { Cell, ResourceList } from '@/components/resource-list'
import { listAssignments } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Teaching assignments · Async School' }

export default function AssignmentsPage() {
  return (
    <ResourceList
      title="Teaching assignments"
      subtitle="One active teacher per subject, class and term — enforced by Odoo, not here."
      load={() => listAssignments({ limit: 50 })}
      columns={['Teacher', 'Subject', 'Class', 'Term', 'Role', 'Periods/wk', 'Status']}
      emptyTitle="No assignments visible"
      emptyHint="Teachers see only their own assignments."
      renderRow={(row) => (
        <>
          <Cell strong>{m2oLabel(row.teacher_id)}</Cell>
          <Cell>{m2oLabel(row.subject_id)}</Cell>
          <Cell>{m2oLabel(row.class_id)}</Cell>
          <Cell>{m2oLabel(row.term_id)}</Cell>
          <Cell>{formatSelection(row.responsibility)}</Cell>
          <Cell numeric>{row.weekly_periods}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
