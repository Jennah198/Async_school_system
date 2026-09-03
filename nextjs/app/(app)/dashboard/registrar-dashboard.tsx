import Link from 'next/link'
import { CommandHeader, KpiBand, NeedsAttention, Panel, Section } from '@/components/dashboard/command-center'
import { LinkButton, StatusBadge } from '@/components/ui'
import { ChartNote } from '@/components/dashboard/charts'
import {
  documentsAwaitingVerification,
  recentRegistrations,
  registrationsAwaitingAction,
} from '@/lib/odoo/models/dashboard'
import {
  attendanceOverview,
  staffOverview,
  structureOverview,
  studentOverview,
  type AcademicPeriods,
  type Scope,
} from '@/lib/odoo/models/overview'
import { formatDate, pluralise } from '@/lib/format'
import { m2oLabel, type CurrentUser } from '@/lib/odoo/types'
import {
  AttendanceToday,
  AttendanceTrend,
  RegistrationFunnel,
  SchoolStructure,
  StaffStates,
  StudentIntake,
  StudentsByGrade,
} from './sections'

/**
 * The Registrar's command centre: intake and the people on the roll.
 *
 * The Registrar has the widest read of any role here — students, staff,
 * teachers, classes, grades, subjects, enrolments, attendance, documents and
 * the academic calendar — and, unlike the Director, write access to most of
 * it. This is the role that actually moves records through their workflows,
 * so the screen leads with the queues and the pipeline rather than with
 * outcomes.
 */
export async function RegistrarDashboard({
  user,
  scope,
}: {
  user: CurrentUser
  scope: Scope & { periods: AcademicPeriods }
}) {
  const [students, staff, structure, attendance, recent, awaitingRegistration, awaitingDocuments] =
    await Promise.all([
      studentOverview(scope),
      staffOverview(),
      structureOverview(scope),
      attendanceOverview(scope),
      recentRegistrations(6),
      registrationsAwaitingAction(),
      documentsAwaitingVerification(),
    ])

  const draftStaff = staff.byState?.find((bucket) => bucket.value === 'draft')?.count ?? null
  const draftStudents =
    students.byRegistration?.find((bucket) => bucket.value === 'draft')?.count ?? null

  return (
    <>
      <CommandHeader
        name={user.name}
        role="Registrar"
        department={user.school_department || undefined}
        scope={scope}
        periods={scope.periods}
        action={
          <span className="flex flex-wrap gap-2">
            <LinkButton href="/students/new" variant="primary" icon="plus" size="sm">
              Register a student
            </LinkButton>
            <LinkButton href="/staff/new" icon="staff" size="sm">
              Register staff
            </LinkButton>
          </span>
        }
      />

      <KpiBand
        items={[
          {
            label: 'Students',
            value: students.total,
            context:
              students.active !== null && students.total !== null
                ? `${students.active} active of ${students.total}`
                : undefined,
            icon: 'students',
            href: '/students',
            spark: students.intake?.points.map((point) => point.value),
          },
          {
            label: 'Classes',
            value: structure.classes,
            context:
              structure.seats !== null
                ? `${pluralise(structure.seats, 'seat')} configured`
                : undefined,
            icon: 'classes',
            href: '/classes',
          },
          {
            label: 'Staff',
            value: staff.total,
            context: staff.active !== null ? `${staff.active} active` : undefined,
            icon: 'staff',
            href: '/staff',
          },
          {
            label: 'Teaching profiles',
            value: staff.teachers,
            context:
              staff.activeTeachers !== null ? `${staff.activeTeachers} teaching` : undefined,
            icon: 'teachers',
            href: '/teachers',
          },
        ]}
      />

      <Section title="Your queue" hint="Records that have stopped moving and are waiting on you.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <Panel title="Waiting on you" icon="check">
            <NeedsAttention
              items={[
                {
                  label: 'Registrations to review',
                  count: awaitingRegistration,
                  href: '/students?status=submitted',
                  icon: 'students',
                  action: 'Submitted or pending verification',
                },
                {
                  label: 'Documents to verify',
                  count: awaitingDocuments,
                  href: '/documents?status=uploaded',
                  icon: 'documents',
                  action: 'Uploaded and unchecked',
                },
                {
                  label: 'Students still in draft',
                  count: draftStudents,
                  href: '/students?status=draft',
                  icon: 'students',
                  action: 'Started but never submitted',
                },
                {
                  label: 'Staff records in draft',
                  count: draftStaff,
                  href: '/staff?status=draft',
                  icon: 'staff',
                  action: 'Cannot hold a teaching profile until activated',
                },
              ]}
            />
          </Panel>
          <div className="lg:col-span-2">
            <RegistrationFunnel students={students} />
          </div>
        </div>
      </Section>

      <Section title="The roll" hint="Where students sit, and how they arrived.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StudentsByGrade students={students} />
          </div>
          <StudentIntake students={students} />
        </div>
      </Section>

      <Section title="Today">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <AttendanceToday attendance={attendance} />
          <AttendanceTrend attendance={attendance} />
          <Panel
            title="Latest registrations"
            icon="enrolment"
            href="/students"
            restricted={recent === null}
            empty={
              recent && recent.rows.length === 0 ? { title: 'No students registered yet' } : false
            }
          >
            {recent && recent.rows.length > 0 ? (
              <>
                <ul className="space-y-0">
                  {recent.rows.map((row, index) => (
                    <li
                      key={row.id}
                      className={index > 0 ? 'border-t border-silver/60 py-2' : 'py-2'}
                    >
                      <Link
                        href={`/students/${row.id}`}
                        className="-mx-1.5 flex items-center gap-3 rounded-[8px] px-1.5 py-1 hover:bg-paper"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-graphite">
                            {row.name}
                          </span>
                          <span className="block truncate text-[11px] text-stone">
                            {m2oLabel(row.class_id)}
                            {row.registration_date ? (
                              <>
                                <span className="text-silver"> · </span>
                                {formatDate(row.registration_date)}
                              </>
                            ) : null}
                          </span>
                        </span>
                        <StatusBadge state={row.registration_status} size="sm" />
                      </Link>
                    </li>
                  ))}
                </ul>
                <ChartNote>
                  Ordered by registration date. Odoo scopes this list to the records your role may
                  see.
                </ChartNote>
              </>
            ) : null}
          </Panel>
        </div>
      </Section>

      <Section title="The school">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SchoolStructure structure={structure} staff={staff} />
          </div>
          <StaffStates staff={staff} />
        </div>
      </Section>
    </>
  )
}
