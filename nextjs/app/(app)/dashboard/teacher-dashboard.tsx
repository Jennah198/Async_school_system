import { Cell, DataTable, DateText, LinkButton, Row, RowLink, StatusBadge } from '@/components/ui'
import {
  CommandHeader,
  KpiBand,
  NeedsAttention,
  Panel,
  Section,
} from '@/components/dashboard/command-center'
import { BarRows, ChartNote, Donut, toneFill } from '@/components/dashboard/charts'
import {
  formatEthiopianDate,
  formatSelection,
  formatPercent,
  formatTimeRange,
  pluralise,
  trimNumber,
  weekdayName,
} from '@/lib/format'
import { statusLabel } from '@/lib/status'
import { attendanceTodayByStatus, classesForTeacher, safeCount, todaysLessons } from '@/lib/odoo/models/dashboard'
import { groupBy, aggregate } from '@/lib/odoo/analytics'
import { listAssignmentsForTeacher } from '@/lib/odoo/models/teacher'
import { listAssessmentsAwaitingEntry } from '@/lib/odoo/models/assessment'
import { listLiveAnnouncements } from '@/lib/odoo/models/operations'
import type { AcademicPeriods, Scope } from '@/lib/odoo/models/overview'
import { m2oId, m2oLabel, type CurrentUser } from '@/lib/odoo/types'

/**
 * The teacher's command centre.
 *
 * A teacher is not a small administrator, and this screen is deliberately not
 * a narrowed copy of the school-wide one. What a teacher needs on the way in
 * is today's lessons, the mark lists waiting on them, whether the register has
 * been taken, and how their own classes are doing — not the school's
 * enrolment funnel.
 *
 * Everything here is already scoped by Odoo's record rules rather than by a
 * filter written on this side: a teacher's assessments, attendance, marks and
 * classes are narrowed to their own assignments before this code sees them.
 * The `teacherId` below says *whose page this is*, not who is allowed to see
 * it — that distinction is why passing it is safe.
 */
export async function TeacherDashboard({
  user,
  scope,
}: {
  user: CurrentUser
  scope: Scope & { periods: AcademicPeriods }
}) {
  const teacherId = m2oId(user.school_teacher_id)
  const classIds = user.school_taught_class_ids ?? []

  const [
    lessons,
    awaitingEntry,
    classes,
    attendanceToday,
    announcements,
    myStudents,
    assignments,
    myMarksBySubject,
    myMean,
  ] = await Promise.all([
    teacherId ? todaysLessons(teacherId) : Promise.resolve(null),
    listAssessmentsAwaitingEntry(5),
    classesForTeacher(classIds),
    attendanceTodayByStatus(),
    listLiveAnnouncements(3),
    classIds.length ? safeCount('school.student', [['class_id', 'in', classIds]]) : Promise.resolve(null),
    // Record rules already narrow assignments to this teacher's own rows.
    teacherId ? listAssignmentsForTeacher(teacherId, 50) : Promise.resolve(null),
    /*
      No teacher filter on either of these. `school.mark` is already narrowed
      to the marks this teacher may read, so adding a domain here would either
      duplicate a rule that already holds or, worse, differ from it.
    */
    groupBy('school.mark', 'subject_id', { measure: 'percentage:avg' }),
    aggregate('school.mark', 'percentage:avg'),
  ])

  /*
    "My subjects" and "my classes" come from the teacher's own active
    assignments rather than being counted separately, so the dashboard cannot
    disagree with the assignment records it links to. An assignment that has
    ended stops contributing, which is the point of the state.
  */
  const activeAssignments = assignments?.rows.filter((row) => row.state === 'active') ?? []
  const mySubjects = [
    ...new Map(
      activeAssignments
        .filter((row) => row.subject_id)
        .map((row) => [
          (row.subject_id as [number, string])[0],
          (row.subject_id as [number, string])[1],
        ]),
    ),
  ]
  const myClasses = [
    ...new Map(
      activeAssignments
        .filter((row) => row.class_id)
        .map((row) => [
          (row.class_id as [number, string])[0],
          (row.class_id as [number, string])[1],
        ]),
    ),
  ]

  const recordedToday = attendanceToday?.reduce((sum, group) => sum + group.count, 0) ?? 0
  const notRecorded = attendanceToday?.find((group) => group.value === 'not_recorded')?.count ?? null
  const presentToday = attendanceToday?.find((group) => group.value === 'present')?.count ?? 0
  const weeklyPeriods = activeAssignments.reduce((total, row) => total + (row.weekly_periods ?? 0), 0)

  return (
    <>
      <CommandHeader
        name={user.name}
        role="Teacher"
        department={user.school_department || undefined}
        scope={scope}
        periods={scope.periods}
        action={
          <span className="flex flex-wrap gap-2">
            <LinkButton href="/attendance" variant="primary" icon="attendance" size="sm">
              Take attendance
            </LinkButton>
            <LinkButton href="/assessments" icon="assessments" size="sm">
              Enter marks
            </LinkButton>
            <LinkButton href="/schedule" icon="timetable" size="sm">
              My timetable
            </LinkButton>
          </span>
        }
      />

      <KpiBand
        items={[
          {
            label: 'Lessons today',
            value: lessons ? lessons.rows.length : null,
            context: weekdayName(
              new Date().getDay() === 0 ? '6' : String(new Date().getDay() - 1),
            ),
            icon: 'timetable',
            href: '/schedule',
          },
          {
            label: 'My classes',
            value: myClasses.length || (classes ? classes.rows.length : null),
            context: `${pluralise(mySubjects.length, 'subject')}, from your active assignments`,
            icon: 'classes',
            href: '/assignments',
          },
          {
            label: 'My students',
            value: myStudents,
            context: 'Across the classes you teach',
            icon: 'students',
            href: '/students',
          },
          {
            label: 'Mark lists open',
            value: awaitingEntry ? awaitingEntry.total : null,
            context: 'Open or returned to you',
            icon: 'assessments',
            href: '/assessments?status=open',
          },
        ]}
      />

      <Section title="Today" hint="Your lessons, your register, and what is waiting on you.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel
              title="Today's lessons"
              icon="timetable"
              href="/schedule"
              hrefLabel="Full timetable"
              bare
              restricted={teacherId !== null && lessons === null}
              empty={
                !lessons || lessons.rows.length === 0
                  ? {
                      title: teacherId ? 'No lessons scheduled today' : 'No teacher profile linked',
                      hint: teacherId
                        ? 'Your published timetable slots for today appear here.'
                        : 'A teaching profile is created when a staff member takes a teaching responsibility.',
                    }
                  : undefined
              }
            >
              {lessons && lessons.rows.length > 0 ? (
                <DataTable
                  caption="Lessons scheduled for today"
                  columns={[
                    { key: 'time', label: 'Time' },
                    { key: 'class', label: 'Class' },
                    { key: 'subject', label: 'Subject' },
                    { key: 'room', label: 'Room', hideBelow: 'sm' },
                    { key: 'state', label: 'Status' },
                  ]}
                >
                  {lessons.rows.map((slot) => (
                    <Row key={slot.id}>
                      <Cell strong>
                        <RowLink href={`/schedule/${slot.id}`}>
                          <span className="tabular">
                            {formatTimeRange(slot.start_time, slot.end_time)}
                          </span>
                        </RowLink>
                      </Cell>
                      <Cell>{m2oLabel(slot.class_id)}</Cell>
                      <Cell>{m2oLabel(slot.subject_id)}</Cell>
                      <Cell hideBelow="sm">{m2oLabel(slot.room_id)}</Cell>
                      <Cell>
                        <StatusBadge state={slot.state} model="school.class.schedule" size="sm" />
                      </Cell>
                    </Row>
                  ))}
                </DataTable>
              ) : null}
            </Panel>
          </div>

          <Panel title="Waiting on you" icon="check">
            <NeedsAttention
              items={[
                {
                  label: 'Mark lists to complete',
                  count: awaitingEntry?.total ?? null,
                  href: '/assessments?status=open',
                  icon: 'assessments',
                  action: 'Opened or returned to you',
                },
                {
                  label: "Today's register",
                  count: notRecorded,
                  href: '/attendance',
                  icon: 'attendance',
                  action: 'Students not yet marked',
                },
              ]}
            />
          </Panel>
        </div>
      </Section>

      <Section title="My classes" hint="Attendance and marks across the classes you teach.">
        <div className="grid items-start gap-3 lg:grid-cols-3">
          <Panel
            title="Attendance today"
            icon="attendance"
            href="/attendance"
            restricted={attendanceToday === null}
            /*
              An unrecorded register is not an empty one. A teacher who has not
              taken it yet must see "not taken", never a percentage.
            */
            empty={
              attendanceToday && recordedToday === 0
                ? {
                    title: 'Register not taken yet',
                    hint: 'Generate a roster from the attendance screen to take it.',
                  }
                : undefined
            }
          >
            {attendanceToday && recordedToday > 0 ? (
              <>
                <Donut
                  segments={attendanceToday.map((group) => ({
                    value: group.value,
                    label: statusLabel(group.value),
                    count: group.count,
                    fill: toneFill(group.value),
                  }))}
                  centre={`${Math.round((presentToday / recordedToday) * 100)}%`}
                  centreLabel={`${formatPercent((presentToday / recordedToday) * 100, 0)} present`}
                  caption={`Today's register: ${attendanceToday
                    .map((group) => `${statusLabel(group.value)} ${group.count}`)
                    .join(', ')}`}
                />
                <ChartNote>
                  {pluralise(recordedToday, 'student')} marked today across your classes.
                </ChartNote>
              </>
            ) : null}
          </Panel>

          <Panel
            title="My subject averages"
            icon="marks"
            href="/assessments"
            hint="Mean mark across the scores you can see."
            restricted={myMarksBySubject === null}
            empty={
              myMarksBySubject && myMarksBySubject.length === 0
                ? {
                    title: 'No marks recorded yet',
                    hint: 'Averages appear once marks are entered against your assessments.',
                  }
                : undefined
            }
          >
            {myMarksBySubject && myMarksBySubject.length > 0 ? (
              <>
                <BarRows
                  data={[...myMarksBySubject].sort((a, b) => (b.measure ?? 0) - (a.measure ?? 0))}
                  weigh={(datum) => datum.measure ?? 0}
                  format={(datum) => `${trimNumber(datum.measure ?? 0)}%`}
                  max={100}
                  limit={6}
                  hrefFor={(datum) => `/assessments?subject=${datum.value}`}
                />
                <ChartNote>
                  Scaled against 100%.
                  {myMean
                    ? ` Your mean is ${trimNumber(myMean.value)}% over ${pluralise(myMean.count, 'mark')}.`
                    : ''}
                </ChartNote>
              </>
            ) : null}
          </Panel>

          <Panel
            title="My classes and subjects"
            icon="classes"
            hint="Only what your own active assignments cover."
            empty={
              myClasses.length === 0 && mySubjects.length === 0
                ? {
                    title: 'Nothing assigned yet',
                    hint: 'Your classes and subjects appear here once you hold an active assignment.',
                  }
                : undefined
            }
          >
            {myClasses.length || mySubjects.length ? (
              <>
                <dl className="space-y-4 text-[13px]">
                  <div>
                    <dt className="text-[11px] tracking-wide text-stone uppercase">Classes</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {myClasses.map(([classId, name]) => (
                        <span
                          key={classId}
                          className="rounded-[9999px] bg-paper px-2.5 py-1 text-[12px] text-graphite"
                        >
                          {name}
                        </span>
                      ))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] tracking-wide text-stone uppercase">Subjects</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {mySubjects.map(([subjectId, name]) => (
                        <span
                          key={subjectId}
                          className="rounded-[9999px] bg-paper px-2.5 py-1 text-[12px] text-graphite"
                        >
                          {name}
                        </span>
                      ))}
                    </dd>
                  </div>
                </dl>
                <ChartNote>
                  {pluralise(weeklyPeriods, 'period')} a week across{' '}
                  {pluralise(activeAssignments.length, 'active assignment')}.
                </ChartNote>
              </>
            ) : null}
          </Panel>
        </div>
      </Section>

      <Section title="My work">
        <div className="grid items-start gap-3 lg:grid-cols-2">
          <Panel
            title="Mark lists open to you"
            icon="assessments"
            href="/assessments"
            bare
            restricted={awaitingEntry === null}
            empty={
              awaitingEntry && awaitingEntry.rows.length === 0
                ? {
                    title: 'No mark lists open',
                    hint: 'A mark list appears here once an assessment is opened, or returned to you for correction.',
                  }
                : undefined
            }
          >
            {awaitingEntry && awaitingEntry.rows.length > 0 ? (
              <DataTable
                caption="Assessments awaiting mark entry"
                columns={[
                  { key: 'name', label: 'Assessment' },
                  { key: 'class', label: 'Class' },
                  { key: 'date', label: 'Date', hideBelow: 'sm' },
                  { key: 'marks', label: 'Marks', numeric: true },
                  { key: 'state', label: 'Status' },
                ]}
              >
                {awaitingEntry.rows.map((assessment) => (
                  <Row key={assessment.id}>
                    <Cell strong>
                      <RowLink href={`/assessments/${assessment.id}`}>{assessment.name}</RowLink>
                    </Cell>
                    <Cell>{m2oLabel(assessment.class_id)}</Cell>
                    <Cell hideBelow="sm">{<DateText value={assessment.date} />}</Cell>
                    <Cell numeric>{assessment.mark_count}</Cell>
                    <Cell>
                      <StatusBadge state={assessment.state} size="sm" />
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            ) : null}
          </Panel>

          <Panel
            title="My assignments"
            icon="assignments"
            href="/assignments"
            hint="What you are timetabled to teach, and for which term."
            bare
            restricted={teacherId !== null && assignments === null}
            empty={
              !teacherId
                ? {
                    title: 'No teaching profile linked',
                    hint: 'Assignments hang off a teaching profile, which hangs off your staff record.',
                  }
                : assignments && assignments.rows.length === 0
                  ? {
                      title: 'No assignments yet',
                      hint: 'A registrar assigns you to a subject and class for a given term.',
                    }
                  : undefined
            }
          >
            {assignments && assignments.rows.length > 0 ? (
              <DataTable
                caption="Your teaching assignments"
                columns={[
                  { key: 'subject', label: 'Subject' },
                  { key: 'class', label: 'Class' },
                  { key: 'term', label: 'Term', hideBelow: 'sm' },
                  { key: 'role', label: 'Role', hideBelow: 'lg' },
                  { key: 'periods', label: 'Periods', numeric: true },
                  { key: 'state', label: 'Status' },
                ]}
              >
                {assignments.rows.slice(0, 8).map((row) => (
                  <Row key={row.id}>
                    <Cell strong>
                      <RowLink href={`/assignments/${row.id}`}>{m2oLabel(row.subject_id)}</RowLink>
                    </Cell>
                    <Cell>{m2oLabel(row.class_id)}</Cell>
                    <Cell hideBelow="sm">{m2oLabel(row.term_id)}</Cell>
                    <Cell hideBelow="lg">{formatSelection(row.responsibility)}</Cell>
                    <Cell numeric>{row.weekly_periods}</Cell>
                    <Cell>
                      <StatusBadge state={row.state} size="sm" />
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            ) : null}
          </Panel>
        </div>
      </Section>

      {announcements && announcements.rows.length > 0 ? (
        <Section title="Noticeboard">
          <Panel
            title="Announcements"
            icon="announcements"
            href="/announcements"
            hint="Live now and addressed to you."
          >
            <ul className="space-y-2">
              {announcements.rows.map((item) => (
                <li key={item.id} className="flex items-baseline justify-between gap-4">
                  <RowLink href={`/announcements/${item.id}`}>{item.name}</RowLink>
                  <span className="shrink-0 text-[11px] text-stone">
                    {formatEthiopianDate(item.publish_datetime || undefined)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </Section>
      ) : null}
    </>
  )
}
