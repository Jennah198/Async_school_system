import { CommandHeader, KpiBand, NeedsAttention, Panel, Section } from '@/components/dashboard/command-center'
import {
  assessmentsAwaitingApproval,
  documentsAwaitingVerification,
  promotionsAwaitingApproval,
  registrationsAwaitingAction,
  reportCardsAwaitingApproval,
} from '@/lib/odoo/models/dashboard'
import {
  attendanceOverview,
  performanceOverview,
  recentActivity,
  staffOverview,
  structureOverview,
  studentOverview,
  type AcademicPeriods,
  type Scope,
} from '@/lib/odoo/models/overview'
import { pluralise } from '@/lib/format'
import type { CurrentUser } from '@/lib/odoo/types'
import {
  AssessmentPipeline,
  AttendanceToday,
  AttendanceTrend,
  PerformanceBySubject,
  RecentActivity,
  RegistrationFunnel,
  ReportCardPipeline,
  SchoolStructure,
  StaffStates,
  StudentsByGrade,
} from './sections'

/**
 * The Administrator's command centre.
 *
 * Administrator and Director were the same screen until now, and that was
 * wrong in a way worth naming: their access is not the same and neither is
 * their job. `group_school_admin` holds write across the module, so an
 * administrator is the person who *fixes* things — a staff record stuck in
 * draft, a mark list nobody approved, a document queue nobody worked. The
 * Director reads outcomes and cannot change any of them.
 *
 * So this screen is shaped around state and throughput: where records are
 * piling up, which stage of each workflow holds them, and what is one click
 * from being unblocked. The analytics are here too, but they sit under the
 * operational picture rather than above it.
 */
export async function AdminDashboard({
  user,
  scope,
}: {
  user: CurrentUser
  scope: Scope & { periods: AcademicPeriods }
}) {
  /*
    Every read starts at once. Nothing below awaits anything else above it, so
    the page costs the slowest query rather than the sum — and `cache()` inside
    the service means a figure wanted by both a tile and a chart is fetched
    once.
  */
  const [
    students,
    staff,
    structure,
    attendance,
    performance,
    activity,
    pendingRegistrations,
    pendingDocuments,
    pendingAssessments,
    pendingReportCards,
    pendingPromotions,
  ] = await Promise.all([
    studentOverview(scope),
    staffOverview(),
    structureOverview(scope),
    attendanceOverview(scope),
    performanceOverview(scope),
    recentActivity(10),
    registrationsAwaitingAction(),
    documentsAwaitingVerification(),
    assessmentsAwaitingApproval(),
    reportCardsAwaitingApproval(),
    promotionsAwaitingApproval(),
  ])

  const draftStaff = staff.byState?.find((bucket) => bucket.value === 'draft')?.count ?? null

  return (
    <>
      <CommandHeader
        name={user.name}
        role="Administrator"
        department={user.school_department || undefined}
        scope={scope}
        periods={scope.periods}
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
            label: 'Staff',
            value: staff.total,
            context:
              staff.active !== null ? `${staff.active} active` : undefined,
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
        ]}
      />

      <Section title="Needs attention" hint="Queues where a decision is the only thing missing.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <Panel title="Waiting on a decision" icon="check" className="lg:col-span-1">
            <NeedsAttention
              items={[
                {
                  label: 'Registrations to review',
                  count: pendingRegistrations,
                  href: '/students?status=submitted',
                  icon: 'students',
                  action: 'Submitted or pending verification',
                },
                {
                  label: 'Documents to verify',
                  count: pendingDocuments,
                  href: '/documents?status=uploaded',
                  icon: 'documents',
                  action: 'Uploaded and unchecked',
                },
                {
                  label: 'Mark lists to approve',
                  count: pendingAssessments,
                  href: '/assessments?status=submitted',
                  icon: 'assessments',
                  action: 'Submitted by a teacher',
                },
                {
                  label: 'Report cards to approve',
                  count: pendingReportCards,
                  href: '/report-cards?status=draft',
                  icon: 'reportCards',
                  action: 'Drafted, not yet published',
                },
                {
                  label: 'Promotion batches to approve',
                  count: pendingPromotions,
                  href: '/promotion',
                  icon: 'promotion',
                  action: 'Calculated, awaiting sign-off',
                },
                {
                  label: 'Staff records still in draft',
                  count: draftStaff,
                  href: '/staff?status=draft',
                  icon: 'staff',
                  action: 'Cannot hold a teaching profile until activated',
                },
              ]}
            />
          </Panel>
          <AssessmentPipeline performance={performance} />
          <ReportCardPipeline performance={performance} />
        </div>
      </Section>

      <Section title="People" hint="Who is on the roll, and where they sit.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StudentsByGrade students={students} />
          </div>
          <AttendanceToday attendance={attendance} />
        </div>
      </Section>

      <Section title="Academics" hint="Marks and attendance over the scope above.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PerformanceBySubject performance={performance} />
          </div>
          <AttendanceTrend attendance={attendance} />
        </div>
      </Section>

      <Section title="Operations">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SchoolStructure structure={structure} staff={staff} />
          </div>
          <StaffStates staff={staff} />
        </div>
      </Section>

      <Section title="Activity">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RecentActivity entries={activity} />
          </div>
          <RegistrationFunnel students={students} />
        </div>
      </Section>
    </>
  )
}
