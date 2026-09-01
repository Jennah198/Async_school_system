import Link from 'next/link'
import {
  Badge,
  Card,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { listStudents } from '@/lib/odoo/models/school'
import { toOdooError } from '@/lib/odoo/errors'
import { m2oLabel } from '@/lib/odoo/types'
import { SearchField } from '@/components/search-field'
import { hasAccess } from '@/lib/odoo/client'

export const metadata = { title: 'Students · Async School' }

const PAGE_SIZE = 25

const STATUS_TONE = {
  approved: 'solid',
  submitted: 'live',
  rejected: 'muted',
} as const

/**
 * Filtering and paging are pushed into Odoo's domain/limit/offset rather than
 * fetched wholesale and narrowed in React — the record rules also scope this
 * per user, so "everything" is never the right query.
 */
export default async function StudentsPage({ searchParams }: PageProps<'/students'>) {
  const params = await searchParams
  const search = typeof params.q === 'string' ? params.q : undefined
  const page = Number(typeof params.page === 'string' ? params.page : '1') || 1
  const offset = (page - 1) * PAGE_SIZE

  const canCreate = await hasAccess('school.student', 'create')

  let result
  try {
    result = await listStudents({ search, limit: PAGE_SIZE, offset })
  } catch (cause) {
    const error = toOdooError(cause)
    return (
      <>
        <PageHeader title="Students" />
        <ErrorState {...error.toClient()} />
      </>
    )
  }

  const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="Students"
        subtitle={`${result.total.toLocaleString()} record${result.total === 1 ? '' : 's'} visible to you`}
        action={
          canCreate ? (
            <Link
              href="/students/new"
              className="rounded-[9999px] bg-ink px-5 py-2.5 text-[13px] font-medium text-white hover:bg-graphite"
            >
              Register student
            </Link>
          ) : undefined
        }
      />

      <Card padded={false}>
        <div className="border-b border-silver p-4">
          <SearchField placeholder="Search by name or student ID" />
        </div>

        {result.rows.length === 0 ? (
          <EmptyState
            title={search ? 'No students match that search' : 'No students visible'}
            hint={
              search
                ? 'Try a different name or student ID.'
                : 'Odoo scopes this list to the records your role may see.'
            }
          />
        ) : (
          <DataTable head={['Name', 'Student ID', 'Class', 'Academic year', 'Registration']}>
            {result.rows.map((row) => (
              <Row key={row.id}>
                <Cell strong>
                  <Link href={`/students/${row.id}`} className="hover:text-action-blue">
                    {row.name}
                  </Link>
                </Cell>
                <Cell>{row.regno || '—'}</Cell>
                <Cell>{m2oLabel(row.class_id)}</Cell>
                <Cell>{m2oLabel(row.academic_year_id)}</Cell>
                <Cell>
                  <Badge
                    tone={
                      STATUS_TONE[row.registration_status as keyof typeof STATUS_TONE] ?? 'neutral'
                    }
                  >
                    {String(row.registration_status || '—').replace(/_/g, ' ')}
                  </Badge>
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}

        {lastPage > 1 ? (
          <div className="flex items-center justify-between border-t border-silver px-4 py-3 text-[13px]">
            <span className="text-slate">
              Page {page} of {lastPage}
            </span>
            <span className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={{ pathname: '/students', query: { ...(search ? { q: search } : {}), page: page - 1 } }}
                  className="rounded-[9999px] border border-silver px-3 py-1.5 hover:bg-paper"
                >
                  Previous
                </Link>
              ) : null}
              {page < lastPage ? (
                <Link
                  href={{ pathname: '/students', query: { ...(search ? { q: search } : {}), page: page + 1 } }}
                  className="rounded-[9999px] border border-silver px-3 py-1.5 hover:bg-paper"
                >
                  Next
                </Link>
              ) : null}
            </span>
          </div>
        ) : null}
      </Card>
    </>
  )
}
