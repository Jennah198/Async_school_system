import Link from 'next/link'
import {
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listReportCards } from '@/lib/odoo/models/assessment'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Report cards · Async School' }


export default function ReportCardsPage() {
  return (
    <ResourceList
      title="Report cards"
      subtitle="Versioned and permanent — Odoo supersedes rather than overwrites, and refuses deletion."
      load={() => listReportCards({ limit: 50 })}
      columns={['Report card', 'Student', 'Class', 'Term', 'Year', 'Status']}
      emptyTitle="No report cards visible"
      emptyHint="Generated from published marks by an Exam Officer."
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/report-cards/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{m2oLabel(row.student_id)}</Cell>
          <Cell>{m2oLabel(row.class_id)}</Cell>
          <Cell>{m2oLabel(row.term_id)}</Cell>
          <Cell>{m2oLabel(row.academic_year_id)}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
