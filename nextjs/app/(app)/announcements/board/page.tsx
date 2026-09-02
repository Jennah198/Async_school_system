import Link from 'next/link'
import { Badge, Card, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { DateText } from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { toOdooError } from '@/lib/odoo/errors'
import { listAnnouncements } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Announcement board - Async School' }

/** The three states an announcement moves through, in that order. */
const COLUMNS = [
  { state: 'draft', label: 'Draft', hint: 'Not yet resolved to recipients' },
  { state: 'published', label: 'Published', hint: 'Recipients resolved and notified' },
  { state: 'archived', label: 'Archived', hint: 'No longer shown' },
]

/**
 * Odoo's `school.announcement.kanban`, as a board.
 *
 * A board earns its place here because an announcement's state is the thing
 * you scan for -- what is still a draft, what went out. The list view remains
 * the right tool for finding a particular one, so both exist.
 */
export default async function AnnouncementBoardPage() {
  let announcements
  try {
    announcements = await listAnnouncements({ limit: 200 })
  } catch (cause) {
    return (
      <>
        <PageHeader title="Announcement board" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/announcements" />
      </>
    )
  }

  const byState = new Map(
    COLUMNS.map((column) => [
      column.state,
      announcements.rows.filter((row) => String(row.state) === column.state),
    ]),
  )

  return (
    <>
      <PageHeader
        title="Announcement board"
        subtitle="Every announcement by publication state."
        breadcrumbs={[{ label: 'Announcements', href: '/announcements' }, { label: 'Board' }]}
        action={
          <Link
            href="/announcements"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            List view
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((column) => {
          const rows = byState.get(column.state) ?? []
          return (
            <section key={column.state} className="min-w-0">
              <div className="mb-3 flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] leading-tight">{column.label}</h2>
                <span className="text-[12px] text-stone tabular">{rows.length}</span>
              </div>
              <p className="mb-3 text-[11px] text-stone">{column.hint}</p>

              {rows.length === 0 ? (
                <Card>
                  <EmptyState title={`Nothing ${column.label.toLowerCase()}`} />
                </Card>
              ) : (
                <ul className="space-y-3 p-0">
                  {rows.map((row) => (
                    <li key={row.id}>
                      <Link href={`/announcements/${row.id}`} className="block">
                        <Card className="transition-colors hover:border-stone">
                          <p className="mb-1.5 text-[14px] font-medium text-graphite">
                            {row.name}
                          </p>
                          <div className="mb-2 flex flex-wrap items-center gap-1.5">
                            <Badge>{formatSelection(row.category)}</Badge>
                            {String(row.priority) === '2' ? (
                              <Badge tone="solid">Urgent</Badge>
                            ) : String(row.priority) === '1' ? (
                              <Badge tone="live">Important</Badge>
                            ) : null}
                            {row.is_live ? <Badge tone="live">Live</Badge> : null}
                          </div>
                          <p className="text-[11px] text-stone">
                            {formatSelection(row.audience_type)}
                            {' - '}
                            {m2oLabel(row.author_id)}
                          </p>
                          <p className="mt-1 text-[11px] text-stone">
                            <DateText value={row.publish_datetime} withTime />
                          </p>
                        </Card>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}
