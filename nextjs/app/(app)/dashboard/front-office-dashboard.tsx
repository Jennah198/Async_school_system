import { Cell, DataTable, LinkButton, Note, Row, RowLink, StatusBadge } from '@/components/ui'
import {
  CountTile,
  DashboardGreeting,
  Panel,
  QuickLinks,
  TileGrid,
} from '@/components/dashboard/panels'
import { StudentLookup } from './student-lookup'
import { formatEthiopianDate, formatEthiopianDateTime, formatSelection, formatText } from '@/lib/format'
import { recentRegistrations, safeCount, upcomingPrograms } from '@/lib/odoo/models/dashboard'
import { listLiveAnnouncements } from '@/lib/odoo/models/operations'
import { m2oLabel, type CurrentUser } from '@/lib/odoo/types'

/**
 * Front Office answers the door and the phone, so the dashboard is built round
 * looking somebody up and knowing what is on today.
 *
 * Its access is narrow by design — README.md grants announcements, all students
 * for contact lookup, and its own staff record. Panels beyond that are simply
 * not rendered rather than shown as refusals, because a screen full of "not
 * available" is not a dashboard.
 */
export async function FrontOfficeDashboard({ user }: { user: CurrentUser }) {
  const [students, announcements, programs, recent] = await Promise.all([
    safeCount('school.student'),
    listLiveAnnouncements(5),
    upcomingPrograms(5),
    recentRegistrations(5),
  ])

  return (
    <>
      <DashboardGreeting
        name={user.name}
        role="Front Office"
        department={user.school_department || undefined}
        action={
          <LinkButton href="/announcements" icon="announcements">
            Announcements
          </LinkButton>
        }
      />

      <QuickLinks
        links={[
          { href: '/students', label: 'Student directory', icon: 'students' },
          { href: '/announcements', label: 'Post an announcement', icon: 'plus' },
        ]}
      />

      <TileGrid>
        <CountTile
          label="Students on file"
          value={students}
          icon="students"
          href="/students"
          hint="Contact lookup"
        />
        <CountTile
          label="Announcements live"
          value={announcements ? announcements.rows.length : null}
          icon="announcements"
          href="/announcements"
        />
        <CountTile
          label="Programs upcoming"
          value={programs ? programs.rows.length : null}
          icon="programs"
          href="/programs"
        />
      </TileGrid>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Find a student"
          icon="search"
          hint="Search the directory by name, student ID or admission number."
        >
          <div className="p-5 pt-1">
            <StudentLookup />
          </div>
        </Panel>

        <Panel
          title="Live announcements"
          icon="announcements"
          href="/announcements"
          restricted={announcements === null}
          empty={
            announcements && announcements.rows.length === 0
              ? {
                  title: 'Nothing live right now',
                  hint: 'A published announcement inside its publish and expiry window shows here.',
                }
              : undefined
          }
        >
          {announcements && announcements.rows.length > 0 ? (
            <ul className="space-y-2.5 p-5 pt-1">
              {announcements.rows.map((item) => (
                <li key={item.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <RowLink href={`/announcements/${item.id}`}>{item.name}</RowLink>
                    <span className="shrink-0 text-[11px] text-stone">
                      {formatEthiopianDateTime(item.publish_datetime)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone">
                    {formatSelection(item.category)} · {formatSelection(item.audience_type)}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        {recent ? (
          <Panel
            title="Recent registrations"
            icon="enrolment"
            href="/students"
            hint="Useful when a parent calls about a new admission."
            empty={recent.rows.length === 0 ? { title: 'No students registered yet' } : undefined}
          >
            {recent.rows.length > 0 ? (
              <DataTable
                caption="Most recently registered students"
                columns={[
                  { key: 'name', label: 'Student' },
                  { key: 'regno', label: 'Student ID', hideBelow: 'sm' },
                  { key: 'class', label: 'Class' },
                  { key: 'status', label: 'Status' },
                ]}
              >
                {recent.rows.map((student) => (
                  <Row key={student.id}>
                    <Cell strong>
                      <RowLink href={`/students/${student.id}`}>{student.name}</RowLink>
                    </Cell>
                    <Cell hideBelow="sm">
                      <span className="tabular">{formatText(student.regno)}</span>
                    </Cell>
                    <Cell>{m2oLabel(student.class_id)}</Cell>
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
        ) : null}

        {programs && programs.rows.length > 0 ? (
          <Panel title="On the calendar" icon="programs" href="/programs">
            <ul className="space-y-2.5 p-5 pt-1">
              {programs.rows.map((program) => (
                <li key={program.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <RowLink href={`/programs/${program.id}`}>{program.name}</RowLink>
                    <span className="shrink-0 text-[11px] text-stone">
                      {formatEthiopianDate(program.start_datetime)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-stone">
                    {formatSelection(program.program_type)}
                    {program.location ? ` · ${program.location}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>

      {students === null ? (
        <Note>
          The student directory is not available to your account. Front Office is granted student
          contact lookup in README.md&apos;s access matrix; if that is missing here it is an
          authorisation question for an administrator, not something the frontend should route
          around.
        </Note>
      ) : null}
    </>
  )
}
