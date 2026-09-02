import Link from 'next/link'
import {
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listPromotionBatches } from '@/lib/odoo/models/assessment'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Promotion · Async School' }


export default function PromotionPage() {
  return (
    <ResourceList
      title="Promotion"
      subtitle="Odoo calculates each outcome from published results, then applies the batch."
      load={listPromotionBatches}
      columns={['Batch', 'From year', 'To year', 'Grade', 'Students', 'Promoted', 'Retained', 'Status']}
      emptyTitle="No promotion batches visible"
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/promotion/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{m2oLabel(row.academic_year_id)}</Cell>
          <Cell>{m2oLabel(row.target_academic_year_id)}</Cell>
          <Cell>{m2oLabel(row.grade_id)}</Cell>
          <Cell numeric>{row.line_count}</Cell>
          <Cell numeric>{row.promoted_count}</Cell>
          <Cell numeric>{row.retained_count}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
