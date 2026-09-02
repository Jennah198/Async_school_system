import Link from 'next/link'
import { formatDate, formatDateTime, formatSelection } from '@/lib/format'
import { notFound } from 'next/navigation'
import { selectionOptions } from '@/lib/odoo/selections'
import { AssignResponsibilityForm } from './assign-responsibility-form'
import {
  Badge,
  Card,
  CardHeader,
  Cell,
  DataTable,
  DetailField,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
  StatusBadge,
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


export default async function StaffDetailPage({ params }: PageProps<'/staff/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let staff, responsibilities, employment, dailyStatus, personal, links, blockers, canWrite, canCreateResp, responsibilityOptions, departmentOptions
try {
  ;[
    staff,
    responsibilities,
    employment,
    dailyStatus,
    personal,
    links,
    blockers,
    canWrite,
    canCreateResp,
    responsibilityOptions,
    departmentOptions,
  ] = await Promise.all([
    getStaff(id),
    listResponsibilities(id),
    listEmployment(id),
    listDailyStatus(id),
    getStaffPersonalData(id),
    getStaffLinks(id),
    getActivationBlockers(id),
    hasAccess('school.staff', 'write'),
    hasAccess('school.staff.responsibility', 'create'),
    selectionOptions('school.staff.responsibility', 'responsibility'),
    selectionOptions('school.staff.responsibility', 'department'),
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
        subtitle={`${staff.staff_id || 'No staff ID yet'} · ${formatSelection(staff.department)}`}
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
              <DetailField label="Job title" value={m2oLabel(staff.job_title_id)} />
              <DetailField
                label="Primary responsibility"
                value={formatSelection(staff.primary_responsibility)}
              />
              <DetailField label="Employment status" value={formatSelection(staff.employment_status)} />
              <DetailField label="Employment type" value={formatSelection(staff.employment_type)} />
              <DetailField label="Hire date" value={formatDate(staff.hire_date)} />
              <DetailField label="End date" value={formatDate(staff.end_date)} />
              <DetailField label="Phone" value={staff.phone || '—'} />
              <DetailField label="Mobile" value={staff.mobile || '—'} />
              <DetailField label="Email" value={staff.email || '—'} />
              <DetailField
                label="Linked employee"
                value={links ? m2oLabel(links.employee_id) : <span className="text-stone">Restricted</span>}
              />
              <DetailField
                label="Odoo login"
                value={links ? m2oLabel(links.user_id) : <span className="text-stone">Restricted</span>}
              />
              <DetailField
                label="Date of birth"
                value={
                  personal ? (
                    personal.date_of_birth || '—'
                  ) : (
                    <span className="text-stone">Restricted to your role</span>
                  )
                }
              />
              <DetailField
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
              <DataTable columns={['Responsibility', 'Primary', 'Department', 'From', 'To', 'Active']}>
                {responsibilities.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{formatSelection(row.responsibility)}</Cell>
                    <Cell>{row.is_primary ? <Badge tone="solid">Primary</Badge> : null}</Cell>
                    <Cell>{formatSelection(row.department)}</Cell>
                    <Cell>{formatDate(row.start_date)}</Cell>
                    <Cell>{formatDate(row.end_date)}</Cell>
                    <Cell>{row.active ? 'Yes' : 'No'}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}

            {/* Assign form – only shown when the user may create */}
            {canCreateResp ? (
              <div className="p-6 pt-2">
                <AssignResponsibilityForm
                  staffId={staff.id}
                  responsibilities={responsibilityOptions}
                  departments={departmentOptions}
                  defaultDepartment={String(staff.department || '')}
                />
              </div>
            ) : null}
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
              <DataTable columns={['Job title', 'Responsibility', 'Manager', 'From', 'To']}>
                {employment.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{m2oLabel(row.job_title_id)}</Cell>
                    <Cell>{formatSelection(row.responsibility)}</Cell>
                    <Cell>{m2oLabel(row.manager_id)}</Cell>
                    <Cell>{formatDate(row.date_start)}</Cell>
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
              <DataTable columns={['Date', 'Status', 'Check in', 'Check out', 'Hours']}>
                {dailyStatus.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{formatDate(row.date)}</Cell>
                    <Cell>{formatSelection(row.status)}</Cell>
                    <Cell>{formatDateTime(row.check_in)}</Cell>
                    <Cell>{formatDateTime(row.check_out)}</Cell>
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
              <StatusBadge state={staff.state} />
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
