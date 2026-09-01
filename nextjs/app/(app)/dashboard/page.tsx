import Link from 'next/link'
import { Badge, Card, CardHeader, DataTable, Cell, EmptyState, PageHeader, Row, Stat } from '@/components/ui'
import { requireSession } from '@/lib/odoo/auth'
import { primaryRoleLabel } from '@/lib/navigation'
import { listAssignments, safeCount } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Dashboard · Async School' }

/**
 * The dashboard is role-shaped rather than one page with everything on it.
 * Counts use safeCount: several roles legitimately cannot read school.student
 * or school.mark (four record rules lack their ACL rows), and a tile should
 * say so rather than fail the page.
 */
export default async function DashboardPage() {
  const { user } = await requireSession()
  const { roles } = user

  const [students, staff, teachers, classes, marks] = await Promise.all([
    safeCount('school.student'),
    safeCount('school.staff'),
    safeCount('school.teacher'),
    safeCount('school.class'),
    safeCount('school.mark'),
  ])

  // Record rules already scope this to the signed-in teacher's own rows.
  const assignments = roles.isTeacher ? await listAssignments({ limit: 8 }) : null

  const tile = (value: number | null) => (value === null ? '—' : value.toLocaleString())
  const hint = (value: number | null) => (value === null ? 'Not available to your role' : undefined)

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]}`}
        subtitle={`Signed in as ${primaryRoleLabel(roles)}${
          user.school_department ? ` · ${user.school_department}` : ''
        }`}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Students" value={tile(students)} hint={hint(students)} />
        <Stat label="Staff" value={tile(staff)} hint={hint(staff)} />
        <Stat label="Teachers" value={tile(teachers)} hint={hint(teachers)} />
        <Stat label="Classes" value={tile(classes)} hint={hint(classes)} />
        <Stat label="Marks" value={tile(marks)} hint={hint(marks)} />
      </div>

      {assignments ? (
        <Card padded={false}>
          <div className="p-6 pb-0">
            <CardHeader
              title="My teaching assignments"
              hint="Scoped by Odoo to the classes and subjects you are assigned."
              action={
                <Link
                  href="/assignments"
                  className="text-[13px] text-action-blue hover:underline"
                >
                  View all
                </Link>
              }
            />
          </div>
          {assignments.rows.length === 0 ? (
            <EmptyState
              title="No teaching assignments yet"
              hint="A registrar assigns you to a subject and class for a given term."
            />
          ) : (
            <DataTable head={['Class', 'Subject', 'Term', 'Periods', 'Status']}>
              {assignments.rows.map((row) => (
                <Row key={row.id}>
                  <Cell strong>{m2oLabel(row.class_id)}</Cell>
                  <Cell>{m2oLabel(row.subject_id)}</Cell>
                  <Cell>{m2oLabel(row.term_id)}</Cell>
                  <Cell numeric>{row.weekly_periods}</Cell>
                  <Cell>
                    <Badge tone={row.state === 'active' ? 'live' : 'muted'}>
                      {String(row.state || '—')}
                    </Badge>
                  </Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Card>
      ) : null}

      {students === null || marks === null ? (
        <Card className="mt-6">
          <CardHeader title="Some areas are unavailable to your role" />
          <p className="text-[13px] text-slate">
            Odoo did not grant access to every model on this page. Where a tile shows a dash, the
            backend refused the read — the frontend deliberately does not work around it.
          </p>
        </Card>
      ) : null}
    </>
  )
}
