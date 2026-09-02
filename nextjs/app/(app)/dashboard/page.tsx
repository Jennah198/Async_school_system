import {
  ActionList,
  CountTile,
  DashboardGreeting,
  Panel,
  QuickLinks,
  StateBreakdown,
  TileGrid,
} from '@/components/dashboard/panels'
import { Note } from '@/components/ui'
import { primaryRoleLabel } from '@/lib/navigation'
import { requireSession } from '@/lib/odoo/auth'
import {
  assessmentsAwaitingApproval,
  groupCount,
  reportCardsAwaitingApproval,
  safeCount,
} from '@/lib/odoo/models/dashboard'
import type { CurrentUser, SchoolRoles } from '@/lib/odoo/types'
import { DirectorDashboard } from './director-dashboard'
import { FrontOfficeDashboard } from './front-office-dashboard'
import { RegistrarDashboard } from './registrar-dashboard'
import { TeacherDashboard } from './teacher-dashboard'

export const metadata = { title: 'Dashboard · Async School' }

/**
 * One route, a different dashboard per role.
 *
 * A shared page with role-aware tiles was the previous shape, and it meant a
 * teacher landed on school-wide counts they could not act on while the thing
 * they actually needed — today's lessons and the mark lists waiting on them —
 * was three clicks away. Each role now gets the screen its job implies.
 *
 * Order matters where somebody holds more than one group: the strongest role
 * wins, matching `primaryRoleLabel`, so an administrator sees the widest view
 * rather than whichever dashboard happened to be checked first.
 */
export default async function DashboardPage() {
  const { user } = await requireSession()
  const { roles } = user

  if (roles.isAdmin || roles.isDirector) return <DirectorDashboard user={user} />
  if (roles.isRegistrar) return <RegistrarDashboard user={user} />
  if (roles.isFrontOffice) return <FrontOfficeDashboard user={user} />
  if (roles.isTeacher) return <TeacherDashboard user={user} />
  return <GeneralDashboard user={user} roles={roles} />
}

/**
 * For Exam Officer, HR and anyone else holding a school group without a
 * dashboard of their own: real counts for what they can read, and the approval
 * queue, which is the part of the job those roles share.
 */
async function GeneralDashboard({ user, roles }: { user: CurrentUser; roles: SchoolRoles }) {
  const [students, staff, assessments, reportCards, assessmentStates, pendingMarks, pendingCards] =
    await Promise.all([
      safeCount('school.student'),
      safeCount('school.staff'),
      safeCount('school.assessment'),
      safeCount('school.report.card'),
      groupCount('school.assessment', 'state'),
      assessmentsAwaitingApproval(),
      reportCardsAwaitingApproval(),
    ])

  const links = [
    ...(roles.isExamOfficer
      ? ([
          { href: '/assessments', label: 'Assessments', icon: 'assessments' },
          { href: '/report-cards', label: 'Report cards', icon: 'reportCards' },
        ] as const)
      : []),
    ...(roles.isHr
      ? ([
          { href: '/staff', label: 'Staff', icon: 'staff' },
          { href: '/documents', label: 'Documents', icon: 'documents' },
        ] as const)
      : []),
  ]

  return (
    <>
      <DashboardGreeting
        name={user.name}
        role={primaryRoleLabel(roles)}
        department={user.school_department || undefined}
      />

      <QuickLinks links={[...links]} />

      <TileGrid>
        <CountTile label="Students" value={students} icon="students" href="/students" />
        <CountTile label="Staff" value={staff} icon="staff" href="/staff" />
        <CountTile
          label="Assessments"
          value={assessments}
          icon="assessments"
          href="/assessments"
        />
        <CountTile
          label="Report cards"
          value={reportCards}
          icon="reportCards"
          href="/report-cards"
        />
      </TileGrid>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Assessment progress"
          icon="assessments"
          href="/assessments"
          hint="The seven-state mark list, from draft through to published."
          restricted={assessmentStates === null}
          empty={
            assessmentStates && assessmentStates.length === 0
              ? { title: 'No assessments yet' }
              : undefined
          }
        >
          {assessmentStates && assessmentStates.length > 0 ? (
            <StateBreakdown
              groups={assessmentStates}
              hrefFor={(group) => `/assessments?status=${group.value}`}
            />
          ) : null}
        </Panel>

        <Panel
          title="Waiting on you"
          icon="check"
          hint="Mark lists and report cards that need an approval."
        >
          <ActionList
            items={[
              {
                label: 'Mark lists submitted for approval',
                count: pendingMarks,
                href: '/assessments?status=submitted',
                icon: 'assessments',
              },
              {
                label: 'Report cards awaiting approval',
                count: pendingCards,
                href: '/report-cards?status=draft',
                icon: 'reportCards',
              },
            ]}
          />
        </Panel>
      </div>

      {students === null && staff === null ? (
        <Note>
          Your role has read access to very little of the school system. That is the backend&apos;s
          answer, not a fault in this screen.
        </Note>
      ) : null}
    </>
  )
}

