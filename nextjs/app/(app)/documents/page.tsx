import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listDocuments } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Documents · Async School' }

const TONE = { verified: 'solid', uploaded: 'live', rejected: 'muted', expired: 'muted' } as const

export default function DocumentsPage() {
  return (
    <ResourceList
      title="Documents"
      subtitle="Odoo records a checksum and refuses to delete document history."
      load={() => listDocuments({ limit: 50 })}
      columns={['Document', 'Type', 'Owner', 'Expires', 'Verified by', 'Status']}
      emptyTitle="No documents visible"
      emptyHint="Document access is restricted to the registrar and HR."
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/documents/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{m2oLabel(row.document_type_id)}</Cell>
          <Cell>{m2oLabel(row.student_id) !== '—' ? m2oLabel(row.student_id) : m2oLabel(row.staff_id)}</Cell>
          <Cell>{row.expiry_date || '—'}</Cell>
          <Cell>{m2oLabel(row.verified_by_id)}</Cell>
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
