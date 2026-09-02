import { CommandHeader, KpiBand, NeedsAttention, Panel, Section } from '@/components/dashboard/command-center'
import { LinkButton, Note } from '@/components/ui'
import {
  assessmentsAwaitingApproval,
  documentsAwaitingVerification,
  reportCardsAwaitingApproval,
} from '@/lib/odoo/models/dashboard'
import {
  performanceOverview,
  recentActivity,
  staffOverview,
  studentOverview,
  type AcademicPeriods,
  type Scope,
} from '@/lib/odoo/models/overview'
import { primaryRoleLabel } from '@/lib/navigation'
import { pluralise, trimNumber } from '@/lib/format'
import type { CurrentUser, SchoolRoles } from '@/lib/odoo/types'
import { AssessmentPipeline, RecentActivity, ReportCardPipeline, StaffStates } from './sections'

/**
 * For Exam Officer, HR, and anyone else holding a school group without a
 * dashboard of their own.
 *
 * These roles are narrow and specific, so the screen does not attempt a
 * school-wide picture: it shows the counts they can read, the workflow they
 * own, and the approvals that are the part of the job those roles share.
 * Whatever Odoo refuses simply does not appear, and the note at the foot says
 * so when almost everything is refused.
 */
export async function GeneralDashboard({
  user,
  roles,
  scope,
}: {
  user: CurrentUser
  roles: SchoolRoles
  scope: Scope & { periods: AcademicPeriods }
}) {
  const [students, staff, performance, activity, pendingMarks, pendingCards, pendingDocuments] =
    await Promise.all([
      studentOverview(scope),
      staffOverview(),
      performanceOverview(scope),
      recentActivity(8),
      assessmentsAwaitingApproval(),
      reportCardsAwaitingApproval(),
      documentsAwaitingVerification(),
    ])

  const reportCardTotal = performance.reportCards
    ? performance.reportCards.reduce((total, bucket) => total + bucket.count, 0)
    : null

  return (
    <>
      <CommandHeader
        name={user.name}
        role={primaryRoleLabel(roles)}
        department={user.school_department || undefined}
        scope={scope}
        periods={scope.periods}
        action={
          <span className="flex flex-wrap gap-2">
            {roles.isExamOfficer ? (
              <>
                <LinkButton href="/assessments" icon="assessments" size="sm">
                  Assessments
                </LinkButton>
                <LinkButton href="/report-cards" icon="reportCards" size="sm">
                  Report cards
                </LinkButton>
              </>
            ) : null}
            {roles.isHr ? (
              <>
                <LinkButton href="/staff" icon="staff" size="sm">
                  Staff
                </LinkButton>
                <LinkButton href="/documents" icon="documents" size="sm">
                  Documents
                </LinkButton>
              </>
            ) : null}
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
          },
          {
            label: 'Staff',
            value: staff.total,
            context: staff.active !== null ? `${staff.active} active` : undefined,
            icon: 'staff',
            href: '/staff',
          },
          {
            label: 'Mean mark',
            value: performance.overall ? Math.round(performance.overall.value) : null,
            context: performance.overall
              ? `${trimNumber(performance.overall.value)}% over ${pluralise(performance.overall.count, 'mark')}`
              : 'No marks recorded in this scope',
            icon: 'marks',
            href: '/assessments',
          },
          {
            label: 'Report cards',
            value: reportCardTotal,
            context: performance.reportCards
              ? `${performance.reportCards.find((bucket) => bucket.value === 'published')?.count ?? 0} published`
              : undefined,
            icon: 'reportCards',
            href: '/report-cards',
          },
        ]}
      />

      <Section title="Waiting on you">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <Panel title="Your queue" icon="check">
            <NeedsAttention
              items={[
                {
                  label: 'Mark lists to approve',
                  count: pendingMarks,
                  href: '/assessments?status=submitted',
                  icon: 'assessments',
                  action: 'Submitted by a teacher',
                },
                {
                  label: 'Report cards to approve',
                  count: pendingCards,
                  href: '/report-cards?status=draft',
                  icon: 'reportCards',
                  action: 'Drafted, not yet published',
                },
                {
                  label: 'Documents to verify',
                  count: pendingDocuments,
                  href: '/documents?status=uploaded',
                  icon: 'documents',
                  action: 'Uploaded and unchecked',
                },
              ]}
            />
          </Panel>
          <AssessmentPipeline performance={performance} />
          <ReportCardPipeline performance={performance} />
        </div>
      </Section>

      <Section title="Activity">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentActivity entries={activity} />
          </div>
          <StaffStates staff={staff} />
        </div>
      </Section>

      {students.total === null && staff.total === null ? (
        <Note>
          Your role has read access to very little of the school system. That is the
          backend&apos;s answer, not a fault in this screen.
        </Note>
      ) : null}
    </>
  )
}
