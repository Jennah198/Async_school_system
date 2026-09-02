import { Cell, DataTable, Row, RowLink, StatusBadge } from '@/components/ui'
import {
  ActionList,
  CountTile,
  DashboardGreeting,
  Panel,
  QuickLinks,
  StateBreakdown,
  TileGrid,
} from '@/components/dashboard/panels'
import { formatDate } from '@/lib/format'
import {
  documentsAwaitingVerification,
  groupCount,
  recentRegistrations,
  registrationsAwaitingAction,
  safeCount,
} from '@/lib/odoo/models/dashboard'
import { m2oLabel, type CurrentUser } from '@/lib/odoo/types'

/**
 * The registrar's day is the registration pipeline: who is waiting, what is
 * unverified, and what came in recently.
 *
 * The pipeline is a grouped aggregate rather than a page of rows counted in
 * TypeScript, so it stays correct — and stays one query — at any school size.
 */
export async function RegistrarDashboard({ user }: { user: CurrentUser }) {
  const [
    students,
    enrolments,
    staff,
    classes,
    pipeline,
    enrolmentStates,
    awaitingRegistration,
    awaitingDocuments,
    recent,
  ] = await Promise.all([
    safeCount('school.student'),
    safeCount('school.enrollment'),
    safeCount('school.staff'),
    safeCount('school.class'),
    groupCount('school.student', 'registration_status'),
    groupCount('school.enrollment', 'state'),
    registrationsAwaitingAction(),
    documentsAwaitingVerification(),
    recentRegistrations(6),
  ])

  return (
    <>
      <DashboardGreeting
        name={user.name}
        role="Registrar"
        department={user.school_department || undefined}
      />

      <QuickLinks
        links={[
          { href: '/students/new', label: 'Register student', icon: 'plus' },
          { href: '/staff/new', label: 'Register staff', icon: 'staff' },
          { href: '/documents', label: 'Verify documents', icon: 'documents' },
          { href: '/configuration', label: 'Academic setup', icon: 'configuration' },
        ]}
      />

      <TileGrid>
        <CountTile label="Students" value={students} icon="students" href="/students" />
        <CountTile label="Enrolments" value={enrolments} icon="enrolment" href="/enrollments" />
        <CountTile label="Staff" value={staff} icon="staff" href="/staff" />
        <CountTile label="Classes" value={classes} icon="classes" href="/classes" />
      </TileGrid>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Waiting on you"
          icon="check"
          hint="Registrations and documents that cannot move without a decision."
        >
          <ActionList
            items={[
              {
                label: 'Registrations to verify or approve',
                count: awaitingRegistration,
                href: '/students?status=submitted',
                icon: 'students',
              },
              {
                label: 'Documents to verify',
                count: awaitingDocuments,
                href: '/documents?status=pending',
                icon: 'documents',
              },
            ]}
          />
        </Panel>

        <Panel
          title="Registration pipeline"
          icon="students"
          href="/students"
          hint="Every student by where their registration has reached."
          restricted={pipeline === null}
          empty={pipeline && pipeline.length === 0 ? { title: 'No registrations yet' } : undefined}
        >
          {pipeline && pipeline.length > 0 ? (
            <StateBreakdown
              groups={pipeline}
              hrefFor={(group) => `/students?status=${group.value}`}
            />
          ) : null}
        </Panel>

        <Panel
          title="Recent registrations"
          icon="enrolment"
          href="/students"
          restricted={recent === null}
          empty={
            recent && recent.rows.length === 0
              ? {
                  title: 'No students registered yet',
                  hint: 'Registering a student is the first step; approval mints the student and admission numbers.',
                }
              : undefined
          }
        >
          {recent && recent.rows.length > 0 ? (
            <DataTable
              caption="Most recently registered students"
              columns={[
                { key: 'name', label: 'Student' },
                { key: 'regno', label: 'Student ID', hideBelow: 'sm' },
                { key: 'class', label: 'Class' },
                { key: 'date', label: 'Registered', hideBelow: 'md' },
                { key: 'status', label: 'Status' },
              ]}
            >
              {recent.rows.map((student) => (
                <Row key={student.id}>
                  <Cell strong>
                    <RowLink href={`/students/${student.id}`}>{student.name}</RowLink>
                  </Cell>
                  <Cell hideBelow="sm">
                    <span className="tabular">{student.regno || '—'}</span>
                  </Cell>
                  <Cell>{m2oLabel(student.class_id)}</Cell>
                  <Cell hideBelow="md">{formatDate(student.registration_date)}</Cell>
                  <Cell>
                    <StatusBadge
                      state={student.registration_status}
                      model="school.student"
                      size="sm"
                    />
                  </Cell>
                </Row>
              ))}
            </DataTable>
          ) : null}
        </Panel>

        <Panel
          title="Enrolments by state"
          icon="enrolment"
          href="/enrollments"
          hint="Activation checks capacity, allocates the roll number and derives the subjects."
          restricted={enrolmentStates === null}
          empty={
            enrolmentStates && enrolmentStates.length === 0
              ? { title: 'No enrolments yet' }
              : undefined
          }
        >
          {enrolmentStates && enrolmentStates.length > 0 ? (
            <StateBreakdown
              groups={enrolmentStates}
              hrefFor={(group) => `/enrollments?status=${group.value}`}
            />
          ) : null}
        </Panel>
      </div>
    </>
  )
}
