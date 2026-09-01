import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Badge,
  Card,
  CardHeader,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { hasAccess } from '@/lib/odoo/client'
import {
  getStaff,
  getStaffPersonalData,
  listDailyStatus,
  listEmployment,
  listResponsibilities,
  getStaffLinks,
  getActivationBlockers,
} from '@/lib/odoo/models/staff'
import { m2oLabel } from '@/lib/odoo/types'
import { WorkflowPanel } from '@/components/workflow-panel'
import { availableTransitions } from '@/lib/odoo/workflows'

export const metadata = { title: 'Staff record · Async School' }

const STATE_TONE = { active: 'solid', draft: 'muted', suspended: 'neutral' } as const

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-stone uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-graphite">{value || '—'}</dd>
    </div>
  )
}

export default async function StaffDetailPage({ params }: PageProps<'/staff/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let staff, responsibilities, employment, dailyStatus, personal, links, blockers, canWrite
  try {
    ;[staff, responsibilities, employment, dailyStatus, personal, links, blockers, canWrite] =
      await Promise.all([
        getStaff(id),
        listResponsibilities(id),
        listEmployment(id),
        listDailyStatus(id),
        getStaffPersonalData(id),
        getStaffLinks(id),
        getActivationBlockers(id),
        hasAccess('school.staff', 'write'),
      ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Staff record" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  if (!staff) notFound()

  return (
    <>
      <PageHeader
        title={staff.name || 'Unnamed staff member'}
        subtitle={`${staff.staff_id || 'No staff ID yet'} · ${String(staff.department || '—')}`}
        action={
          <Link
            href="/staff"
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            Back to staff
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-4 sm:grid-cols-3">
              <Detail label="Job title" value={m2oLabel(staff.job_title_id)} />
              <Detail
                label="Primary responsibility"
                value={String(staff.primary_responsibility || '—').replace(/_/g, ' ')}
              />
              <Detail label="Employment status" value={String(staff.employment_status || '—')} />
              <Detail label="Employment type" value={String(staff.employment_type || '—').replace(/_/g, ' ')} />
              <Detail label="Hire date" value={staff.hire_date || '—'} />
              <Detail label="End date" value={staff.end_date || '—'} />
              <Detail label="Phone" value={staff.phone || '—'} />
              <Detail label="Mobile" value={staff.mobile || '—'} />
              <Detail label="Email" value={staff.email || '—'} />
              <Detail
                label="Linked employee"
                value={links ? m2oLabel(links.employee_id) : <span className="text-stone">Restricted</span>}
              />
              <Detail
                label="Odoo login"
                value={links ? m2oLabel(links.user_id) : <span className="text-stone">Restricted</span>}
              />
              <Detail
                label="Date of birth"
                value={
                  personal ? (
                    personal.date_of_birth || '—'
                  ) : (
                    <span className="text-stone">Restricted to your role</span>
                  )
                }
              />
              <Detail
                label="Fayda ID"
                value={
                  personal ? (
                    /* Shown only because Odoo returned it — never reconstructed. */
                    personal.fayda_id || '—'
                  ) : (
                    <span className="text-stone">Restricted to your role</span>
                  )
                }
              />
            </dl>
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Responsibilities"
                hint="At least one active responsibility is required to leave Draft."
              />
            </div>
            {responsibilities.rows.length === 0 ? (
              <EmptyState title="No responsibilities recorded" />
            ) : (
              <DataTable head={['Responsibility', 'Primary', 'Department', 'From', 'To', 'Active']}>
                {responsibilities.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{String(row.responsibility || '—').replace(/_/g, ' ')}</Cell>
                    <Cell>{row.is_primary ? <Badge tone="solid">Primary</Badge> : null}</Cell>
                    <Cell>{String(row.department || '—')}</Cell>
                    <Cell>{row.start_date}</Cell>
                    <Cell>{row.end_date || '—'}</Cell>
                    <Cell>{row.active ? 'Yes' : 'No'}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Employment history"
                hint="Effective-dated and non-deletable — Odoo refuses to remove these."
              />
            </div>
            {employment === null ? (
              <EmptyState
                title="Not available to your role"
                hint="Employment history is owned by HR — only HR and administrators can read it."
              />
            ) : employment.rows.length === 0 ? (
              <EmptyState
                title="No employment records"
                hint="Odoo creates these as employment periods are recorded."
              />
            ) : (
              <DataTable head={['Job title', 'Responsibility', 'Manager', 'From', 'To']}>
                {employment.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{m2oLabel(row.job_title_id)}</Cell>
                    <Cell>{String(row.responsibility || '—').replace(/_/g, ' ')}</Cell>
                    <Cell>{m2oLabel(row.manager_id)}</Cell>
                    <Cell>{row.date_start}</Cell>
                    <Cell>{row.date_end || 'Current'}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Recent daily status"
                hint="Generated nightly by Odoo from hr.attendance."
              />
            </div>
            {dailyStatus === null ? (
              <EmptyState
                title="Not available to your role"
                hint="Daily status is owned by HR — only HR and administrators can read it."
              />
            ) : dailyStatus.rows.length === 0 ? (
              <EmptyState
                title="No daily status yet"
                hint="The scheduled job records these once the staff member is active."
              />
            ) : (
              <DataTable head={['Date', 'Status', 'Check in', 'Check out', 'Hours']}>
                {dailyStatus.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{row.date}</Cell>
                    <Cell>{String(row.status || '—').replace(/_/g, ' ')}</Cell>
                    <Cell>{row.check_in || '—'}</Cell>
                    <Cell>{row.check_out || '—'}</Cell>
                    <Cell numeric>{row.worked_hours?.toFixed(2)}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <div className="mb-4 flex items-center gap-2">
              <Badge tone={STATE_TONE[staff.state as keyof typeof STATE_TONE] ?? 'neutral'}>
                {String(staff.state || '—')}
              </Badge>
              {!staff.active ? <Badge tone="muted">Archived</Badge> : null}
            </div>
            <WorkflowPanel
              workflow="staff"
              id={staff.id}
              transitions={availableTransitions('staff', String(staff.state || '')).map(
                ({ key, label, confirm, destructive, requiresReason }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={[`/staff/${staff.id}`, '/staff']}
              canWrite={canWrite}
              blockedNote={staff.state === 'draft' ? (blockers ?? undefined) : undefined}
            />
          </Card>
        </div>
      </div>
    </>
  )
}
