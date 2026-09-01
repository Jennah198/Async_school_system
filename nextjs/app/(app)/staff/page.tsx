import Link from 'next/link'
import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { hasAccess } from '@/lib/odoo/client'
import { listStaff } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Staff · Async School' }

const STATE_TONE = { active: 'solid', draft: 'muted', suspended: 'neutral' } as const

export default async function StaffPage() {
  // Odoo's own ACL decides whether the button appears. It is re-checked on the
  // create page and again by Odoo on submit — this only avoids a dead end.
  const canCreate = await hasAccess('school.staff', 'create')

  return (
    <ResourceList
      title="Staff"
      load={() => listStaff({ limit: 50 })}
      columns={['Name', 'Staff ID', 'Department', 'Job title', 'Responsibility', 'Status']}
      emptyTitle="No staff visible"
      emptyHint="Odoo scopes this list to the records your role may see."
      action={
        canCreate ? (
          <Link
            href="/staff/new"
            className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite"
          >
            Register staff
          </Link>
        ) : undefined
      }
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/staff/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{row.staff_id || '—'}</Cell>
          <Cell>{String(row.department || '—')}</Cell>
          <Cell>{m2oLabel(row.job_title_id)}</Cell>
          <Cell>{String(row.primary_responsibility || '—').replace(/_/g, ' ')}</Cell>
          <Cell>
            <Badge tone={STATE_TONE[row.state as keyof typeof STATE_TONE] ?? 'neutral'}>
              {String(row.state || '—')}
            </Badge>
          </Cell>
        </>
      )}
    />
  )
}
