import type { ReactNode } from 'react'
import { Card, Cell, DataTable, EmptyState, ErrorState, PageHeader, Row } from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import type { Page } from '@/lib/odoo/types'

/**
 * The shape every list screen shares: fetch a page from Odoo, render it, and
 * turn a refusal into an explanation rather than a crash.
 *
 * Several roles legitimately cannot read some models — four record rules lack
 * their ACL rows — so FORBIDDEN is an expected outcome here, not an incident.
 */
export async function ResourceList<T extends { id: number }>({
  title,
  subtitle,
  load,
  columns,
  renderRow,
  emptyTitle,
  emptyHint,
  action,
}: {
  title: string
  subtitle?: string
  load: () => Promise<Page<T>>
  columns: string[]
  renderRow: (row: T) => ReactNode
  emptyTitle: string
  emptyHint?: string
  action?: ReactNode
}) {
  let result: Page<T>
  try {
    result = await load()
  } catch (cause) {
    const error = toOdooError(cause)
    return (
      <>
        <PageHeader title={title} />
        <ErrorState {...error.toClient()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={title}
        subtitle={
          subtitle ??
          `${result.total.toLocaleString()} record${result.total === 1 ? '' : 's'} visible to you`
        }
        action={action}
      />
      <Card padded={false}>
        {result.rows.length === 0 ? (
          <EmptyState title={emptyTitle} hint={emptyHint} />
        ) : (
          <DataTable head={columns}>
            {result.rows.map((row) => (
              <Row key={row.id}>{renderRow(row)}</Row>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  )
}

export { Cell }
