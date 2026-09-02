import { BarRows, ChartNote, Donut, Pipeline, Trend, toneFill } from '@/components/dashboard/charts'
import { ActivityFeed, Panel, StructureStrip } from '@/components/dashboard/command-center'
import { formatCount, formatPercent, pluralise, trimNumber } from '@/lib/format'
import { statusLabel } from '@/lib/status'
import type {
  AttendanceOverview,
  PerformanceOverview,
  StaffOverview,
  StructureOverview,
  StudentOverview,
  ActivityEntry,
} from '@/lib/odoo/models/overview'

/*
  The panels the role dashboards are assembled from.

  Each one takes an already-fetched slice of the overview and decides between
  three renderings: restricted, empty, or drawn. Keeping that decision here
  rather than in each dashboard is what stops a Director's screen from claiming
  the school has no classes when the truth is that Odoo will not show them any.

  Every panel also carries a note saying what it counted and over what window.
  A percentage without a denominator is decoration.
*/

/* -------------------------------------------------------------- students --- */

export function StudentsByGrade({ students }: { students: StudentOverview }) {
  const data = students.byGrade
  return (
    <Panel
      title="Students by grade"
      icon="students"
      href="/students"
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No students in this scope' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <BarRows
            data={data}
            /*
              Through /classes, not /students: the student list filters by
              class, and has no grade filter to send them to. Linking to a
              filter that does not exist would be worse than linking to the one
              that does.
            */
            hrefFor={(datum) => (datum.value ? `/classes?grade=${datum.value}` : '/classes')}
          />
          <ChartNote>
            {pluralise(students.total ?? 0, 'student')} across {pluralise(data.length, 'grade')}. A grade&apos;s total is the sum of its
            classes — students are enrolled into a class, not a grade.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function RegistrationFunnel({ students }: { students: StudentOverview }) {
  const data = students.byRegistration
  return (
    <Panel
      title="Registration pipeline"
      icon="enrolment"
      href="/students"
      hint="Where each student sits in the registration workflow."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No registrations yet' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <Pipeline
            stages={order(data, REGISTRATION_ORDER)}
            model="school.student"
            hrefFor={(stage) => `/students?status=${stage.value}`}
          />
          <ChartNote>
            Odoo&apos;s own `registration_status`, in workflow order. A pile in an early stage is
            the backlog.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function StudentIntake({ students }: { students: StudentOverview }) {
  const intake = students.intake
  return (
    <Panel
      title="Intake over time"
      icon="academicYear"
      hint="New registrations per month."
      restricted={intake === null}
      empty={intake !== null && intake.points.length === 0 ? { title: 'No registrations yet' } : false}
    >
      {intake && intake.points.length > 0 ? (
        intake.meaningful ? (
          <>
            <Trend points={intake.points} caption="New student registrations per month" />
            <ChartNote>
              Counted on each student&apos;s registration date. Only months with registrations
              appear — a gap is a month with none, not a month with no data.
            </ChartNote>
          </>
        ) : (
          /*
            One month is a number, not a trend. Drawing a single point as a
            line would imply a direction nobody measured.
          */
          <>
            <p className="tabular text-[27px] leading-none text-graphite">
              {formatCount(intake.points[0].value)}
            </p>
            <p className="mt-1.5 text-[12.5px] text-slate">
              registered in {intake.points[0].label}
            </p>
            <ChartNote>
              All registrations so far fall in one month, so there is no history to trend yet. A
              second month of intake will draw the line.
            </ChartNote>
          </>
        )
      ) : null}
    </Panel>
  )
}

/* ------------------------------------------------------------ attendance --- */

export function AttendanceToday({ attendance }: { attendance: AttendanceOverview }) {
  const today = attendance.today
  return (
    <Panel
      title="Attendance today"
      icon="attendance"
      href="/attendance"
      restricted={today === null}
      /*
        The distinction this whole dashboard turns on. No register taken is not
        nobody present, and it must never render as 0%.
      */
      empty={
        today !== null && attendance.todayTotal === 0
          ? {
              title: 'No register taken today',
              hint: 'Nothing has been recorded yet. This is not the same as nobody being present.',
            }
          : false
      }
    >
      {today && attendance.todayTotal > 0 ? (
        <>
          <Donut
            segments={today.map((bucket) => ({
              value: bucket.value,
              label: statusLabel(bucket.value),
              count: bucket.count,
              fill: toneFill(bucket.value),
            }))}
            centre={`${Math.round(attendance.presentRate ?? 0)}%`}
            centreLabel={`${formatPercent(attendance.presentRate ?? 0, 0)} present`}
            caption={`Today's register: ${today
              .map((bucket) => `${statusLabel(bucket.value)} ${bucket.count}`)
              .join(', ')}`}
          />
          <ChartNote>
            {pluralise(attendance.todayTotal, 'record')} marked today, across the classes you can
            see. The ring shows the share present.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function AttendanceTrend({ attendance }: { attendance: AttendanceOverview }) {
  const trend = attendance.trend
  /*
    Present *rate* per day, not a raw count: a day on which forty students were
    marked and a day on which four hundred were are not comparable as counts,
    but they are as percentages. Both numerator and denominator come out of the
    same grouped query, so the share cannot drift.
  */
  const points =
    trend
      ?.filter((period) => period.total > 0)
      .map((period) => ({
        iso: period.iso,
        label: period.label,
        value: ((period.by.present ?? 0) / period.total) * 100,
      })) ?? []

  return (
    <Panel
      title="Attendance trend"
      icon="attendance"
      href="/attendance"
      hint="Share present, per day the register was taken."
      restricted={trend === null}
      empty={trend !== null && points.length === 0 ? { title: 'No attendance recorded yet' } : false}
    >
      {points.length >= 2 ? (
        <>
          <Trend points={points} caption="Share of students present, per school day" suffix="%" />
          <ChartNote>
            The last {pluralise(points.length, 'day')} on which a register was taken. Days with no register are left out rather than drawn as zero.
          </ChartNote>
        </>
      ) : points.length === 1 ? (
        <>
          <p className="tabular text-[27px] leading-none text-graphite">
            {Math.round(points[0].value)}%
          </p>
          <p className="mt-1.5 text-[12.5px] text-slate">present on {points[0].label}</p>
          <ChartNote>
            Only one day of attendance has been recorded, which is a figure rather than a trend.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

/* ----------------------------------------------------------- performance --- */

export function PerformanceBySubject({ performance }: { performance: PerformanceOverview }) {
  const data = performance.bySubject
  return (
    <Panel
      title="Average by subject"
      icon="marks"
      href="/assessments"
      hint="Mean mark across every recorded score."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No marks recorded yet' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <BarRows
            data={[...data].sort((a, b) => (b.measure ?? 0) - (a.measure ?? 0))}
            weigh={(datum) => datum.measure ?? 0}
            format={(datum) => `${trimNumber(datum.measure ?? 0)}%`}
            max={100}
            limit={8}
            hrefFor={(datum) => `/assessments?subject=${datum.value}`}
          />
          <ChartNote>
            Scaled against 100%, so the bars are comparable with each other and with a pass mark.
            {performance.overall
              ? ` School-wide mean ${trimNumber(performance.overall.value)}% over ${pluralise(performance.overall.count, 'mark')}.`
              : ''}
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function PerformanceByGrade({ performance }: { performance: PerformanceOverview }) {
  const data = performance.byGrade
  return (
    <Panel
      title="Average by grade"
      icon="reportCards"
      href="/report-cards"
      hint="Mean of published report-card averages."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No report cards yet' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <BarRows
            data={data}
            weigh={(datum) => datum.measure ?? 0}
            format={(datum) => `${trimNumber(datum.measure ?? 0)}%`}
            max={100}
          />
          <ChartNote>
            Averaged over {pluralise(
              data.reduce((total, datum) => total + datum.count, 0),
              'report card',
            )}
            . A grade with few cards issued will move a long way on one result.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function AssessmentPipeline({ performance }: { performance: PerformanceOverview }) {
  const data = performance.assessments
  return (
    <Panel
      title="Mark lists"
      icon="assessments"
      href="/assessments"
      hint="The seven-state workflow, from draft to published."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No mark lists yet' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <Pipeline
            stages={order(data, ASSESSMENT_ORDER)}
            hrefFor={(stage) => `/assessments?status=${stage.value}`}
          />
          <ChartNote>Anything left of Published is still waiting on somebody.</ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function ReportCardPipeline({ performance }: { performance: PerformanceOverview }) {
  const data = performance.reportCards
  return (
    <Panel
      title="Report cards"
      icon="reportCards"
      href="/report-cards"
      hint="Draft, approved, published."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No report cards yet' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <Pipeline
            stages={order(data, REPORT_CARD_ORDER)}
            hrefFor={(stage) => `/report-cards?status=${stage.value}`}
          />
          <ChartNote>
            A card is only visible to guardians once it is published. Drafts are the queue.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

/* --------------------------------------------------------------- people --- */

export function StaffComposition({ staff }: { staff: StaffOverview }) {
  const data = staff.byDepartment
  return (
    <Panel
      title="Staff by department"
      icon="staff"
      href="/staff"
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No staff records' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <BarRows
            data={[...data].sort((a, b) => b.count - a.count)}
            hrefFor={(datum) => (datum.value ? `/staff?department=${datum.value}` : '/staff')}
          />
          <ChartNote>
            Odoo&apos;s own department field on the staff record.
            {staff.teachers !== null
              ? ` ${formatCount(staff.activeTeachers ?? 0)} of ${pluralise(staff.teachers, 'teaching profile')} active.`
              : ''}
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

export function StaffStates({ staff }: { staff: StaffOverview }) {
  const data = staff.byState
  return (
    <Panel
      title="Staff records"
      icon="staff"
      href="/staff"
      hint="Draft records cannot hold a teaching profile."
      restricted={data === null}
      empty={data !== null && data.length === 0 ? { title: 'No staff records' } : false}
    >
      {data && data.length > 0 ? (
        <>
          <Pipeline
            stages={order(data, STAFF_ORDER)}
            hrefFor={(stage) => `/staff?status=${stage.value}`}
          />
          <ChartNote>
            A staff record starts in Draft, and Odoo refuses a teaching profile until it is
            activated — the Draft pile is usually work in progress rather than history.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

/* ------------------------------------------------------------ structure --- */

export function SchoolStructure({
  structure,
  staff,
}: {
  structure: StructureOverview
  staff: StaffOverview
}) {
  const byGrade = structure.classesByGrade
  return (
    <Panel
      title="School structure"
      icon="classes"
      href="/classes"
      restricted={byGrade === null && structure.subjects === null}
      empty={
        byGrade !== null && byGrade.length === 0 && structure.subjects === 0
          ? { title: 'Nothing configured yet', hint: 'Grades, classes and subjects define the school.' }
          : false
      }
    >
      <StructureStrip
        items={[
          { label: 'Grades in use', value: structure.grades, href: '/classes' },
          { label: 'Classes', value: structure.classes, href: '/classes' },
          { label: 'Seats', value: structure.seats },
          { label: 'Subjects', value: structure.subjects, href: '/subjects' },
          { label: 'Sections', value: structure.sections },
          { label: 'Teachers', value: staff.teachers, href: '/teachers' },
        ]}
      />
      {byGrade && byGrade.length > 0 ? (
        <div className="mt-4 border-t border-silver/70 pt-3.5">
          <p className="mb-2 text-[11px] text-stone">Classes per grade</p>
          <BarRows
            data={byGrade}
            limit={8}
            hrefFor={(datum) => (datum.value ? `/classes?grade=${datum.value}` : '/classes')}
          />
        </div>
      ) : null}
      <ChartNote>
        &ldquo;Seats&rdquo; is the sum of each class&apos;s configured capacity, which is what the
        school can hold rather than what it currently has.
      </ChartNote>
    </Panel>
  )
}

/* ------------------------------------------------------------- activity --- */

export function RecentActivity({
  entries,
  hint,
}: {
  entries: ActivityEntry[] | null
  hint?: string
}) {
  return (
    <Panel
      title="Recent activity"
      icon="clock"
      hint={hint ?? "From Odoo's own record history."}
      restricted={entries === null}
      empty={entries !== null && entries.length === 0 ? { title: 'Nothing recorded yet' } : false}
    >
      {entries && entries.length > 0 ? (
        <>
          <ActivityFeed entries={entries} />
          <ChartNote>
            Odoo logs this itself on every record. You see only activity on records your role may
            read — the feed is narrowed by the same rules as the rest of the system.
          </ChartNote>
        </>
      ) : null}
    </Panel>
  )
}

/* --------------------------------------------------------------- order --- */

/*
  Workflow order, so a pipeline reads left to right the way the work actually
  moves. Odoo returns groups alphabetically, which puts "approved" before
  "draft" and makes a pipeline look like it flows backwards.

  Any state not listed keeps its position at the end rather than being dropped:
  the addon gains states over time and an unlisted one must still be counted.
*/
const REGISTRATION_ORDER = ['draft', 'incomplete', 'pending_verification', 'submitted', 'approved', 'rejected']
const ASSESSMENT_ORDER = ['draft', 'open', 'submitted', 'returned', 'approved', 'locked', 'published']
const REPORT_CARD_ORDER = ['draft', 'approved', 'published', 'superseded']
const STAFF_ORDER = ['draft', 'active', 'suspended', 'inactive']

function order<T extends { value: string }>(data: T[], sequence: string[]): T[] {
  return [...data].sort((a, b) => {
    const left = sequence.indexOf(a.value)
    const right = sequence.indexOf(b.value)
    return (left === -1 ? sequence.length : left) - (right === -1 ? sequence.length : right)
  })
}
