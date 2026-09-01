import {
  Card,
  CardHeader,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { formatDate, formatSelection } from '@/lib/format'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listClasses } from '@/lib/odoo/models/school'
import { attendanceStatusOptions, listAttendance } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'
import { AttendanceStatus, RosterForm } from './roster-form'

export const metadata = { title: 'Attendance · Async School' }

export default async function AttendancePage({ searchParams }: PageProps<'/attendance'>) {
  const params = await searchParams
  const date = typeof params.date === 'string' ? params.date : undefined
  const classId = typeof params.classId === 'string' ? Number(params.classId) : undefined
  const today = new Date().toISOString().slice(0, 10)

  let attendance, classes, statuses, canWrite
  try {
    ;[attendance, classes, statuses, canWrite] = await Promise.all([
      listAttendance({ date, classId, limit: 200 }),
      listClasses({ limit: 200 }),
      attendanceStatusOptions(),
      hasAccess('school.attendance', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Attendance" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Each row is anchored to the enrolment placement effective on its date."
      />

      {canWrite ? (
        <Card className="mb-4">
          <CardHeader
            title="Take attendance"
            hint="Odoo builds the roster from the placements effective on that date and skips anyone already recorded."
          />
          <RosterForm
            classes={classes.rows.map((c) => ({ id: c.id, name: c.name }))}
            defaultDate={date ?? today}
          />
        </Card>
      ) : null}

      <Card padded={false}>
        <div className="p-6 pb-0">
          <CardHeader
            title="Records"
            hint={`${attendance.total.toLocaleString()} record${attendance.total === 1 ? '' : 's'} visible to you`}
          />
        </div>
        {attendance.rows.length === 0 ? (
          <EmptyState
            title="No attendance records"
            hint="Generate a roster above, or widen the filter."
          />
        ) : (
          <DataTable columns={['Date', 'Student', 'Class', 'Type', 'Period', 'Status']}>
            {attendance.rows.map((row) => (
              <Row key={row.id}>
                <Cell strong>{formatDate(row.date)}</Cell>
                <Cell>{m2oLabel(row.student_id)}</Cell>
                <Cell>{m2oLabel(row.class_id)}</Cell>
                <Cell>{formatSelection(row.attendance_type)}</Cell>
                <Cell>{row.period || '—'}</Cell>
                <Cell>
                  <AttendanceStatus
                    id={row.id}
                    status={String(row.status || '')}
                    options={statuses}
                    editable={canWrite}
                  />
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </Card>
    </>
  )
}
