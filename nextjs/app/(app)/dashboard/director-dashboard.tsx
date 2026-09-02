import {
  ActionList,
  CountTile,
  DashboardGreeting,
  Panel,
  StateBreakdown,
  TileGrid,
} from '@/components/dashboard/panels'
import { Note } from '@/components/ui'
import {
  assessmentsAwaitingApproval,
  groupCount,
  promotionsAwaitingApproval,
  reportCardsAwaitingApproval,
  safeCount,
} from '@/lib/odoo/models/dashboard'
import type { CurrentUser } from '@/lib/odoo/types'

/**
 * The director's view is school-wide and read-only, which is exactly what the
 * backend grants: `group_school_director` holds read on the academic models
 * and write on none of them.
 *
 * Several tiles will show a dash rather than a number, and that is the correct
 * answer rather than a gap to work around — the Director has no ACL row on
 * some academic models. The note at the foot says so in as many words instead
 * of leaving somebody to guess whether the school really has no classes.
 */
export async function DirectorDashboard({ user }: { user: CurrentUser }) {
  const [
    students,
    staff,
    enrolments,
    marks,
    reportCardStates,
    assessmentStates,
    lifecycle,
    pendingReportCards,
    pendingAssessments,
    pendingPromotions,
  ] = await Promise.all([
    safeCount('school.student'),
    safeCount('school.staff'),
    safeCount('school.enrollment'),
    safeCount('school.mark'),
    groupCount('school.report.card', 'state'),
    groupCount('school.assessment', 'state'),
    groupCount('school.student', 'lifecycle_status'),
    reportCardsAwaitingApproval(),
    assessmentsAwaitingApproval(),
    promotionsAwaitingApproval(),
  ])

  const anyRestricted = [students, staff, enrolments, marks].some((value) => value === null)

  return (
    <>
      <DashboardGreeting
        name={user.name}
        role="Director"
        department={user.school_department || undefined}
      />

      <TileGrid>
        <CountTile label="Students" value={students} icon="students" href="/students" />
        <CountTile label="Staff" value={staff} icon="staff" href="/staff" />
        <CountTile label="Enrolments" value={enrolments} icon="enrolment" href="/enrollments" />
        <CountTile label="Marks recorded" value={marks} icon="marks" href="/marks" />
      </TileGrid>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          title="Awaiting approval"
          icon="check"
          hint="Work that has stopped and needs a decision somewhere in the school."
        >
          <ActionList
            items={[
              {
                label: 'Report cards awaiting approval',
                count: pendingReportCards,
                href: '/report-cards?status=draft',
                icon: 'reportCards',
              },
              {
                label: 'Mark lists submitted for approval',
                count: pendingAssessments,
                href: '/assessments?status=submitted',
                icon: 'assessments',
              },
              {
                label: 'Promotion batches calculated, not approved',
                count: pendingPromotions,
                href: '/promotion?status=calculated',
                icon: 'promotion',
              },
            ]}
          />
        </Panel>

        <Panel
          title="Student lifecycle"
          icon="students"
          href="/students"
          hint="Where every student stands, from applicant to graduated."
          restricted={lifecycle === null}
          empty={lifecycle && lifecycle.length === 0 ? { title: 'No students yet' } : undefined}
        >
          {lifecycle && lifecycle.length > 0 ? (
            <StateBreakdown
              groups={lifecycle}
              hrefFor={(group) => `/students?lifecycle=${group.value}`}
            />
          ) : null}
        </Panel>

        <Panel
          title="Report cards"
          icon="reportCards"
          href="/report-cards"
          hint="Generated from published marks, then approved and published."
          restricted={reportCardStates === null}
          empty={
            reportCardStates && reportCardStates.length === 0
              ? {
                  title: 'No report cards yet',
                  hint: 'They are generated once a term has published results.',
                }
              : undefined
          }
        >
          {reportCardStates && reportCardStates.length > 0 ? (
            <StateBreakdown
              groups={reportCardStates}
              hrefFor={(group) => `/report-cards?status=${group.value}`}
            />
          ) : null}
        </Panel>

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
      </div>

      {anyRestricted ? (
        <Note>
          A dash means the school system refused the read for the Director role, not that the
          figure is zero. The frontend deliberately does not work around a refusal — see the
          access matrix in README.md.
        </Note>
      ) : null}
    </>
  )
}
