import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  Badge,
  Card,
  CardHeader,
  Cell,
  DataTable,
  DetailField,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { getClass, listStudents } from '@/lib/odoo/models/school'
import { listCurriculum, listSchedule } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Class · Async School' }

export default async function ClassDetailPage({ params }: PageProps<'/classes/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let klass, students, curriculum, schedule, canWrite
  try {
    ;[klass, students, curriculum, schedule, canWrite] = await Promise.all([
      getClass(id),
      listStudents({ filters: { class: String(id) }, limit: 100 }),
      listCurriculum({ classId: id }),
      listSchedule({ filters: { class: String(id) }, limit: 100 }),
      hasAccess('school.class', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Class" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/classes" />
      </>
    )
  }

  if (!klass) notFound()

  return (
    <>
      <PageHeader
        title={klass.name}
        subtitle={`${m2oLabel(klass.academic_year_id)} · ${students.rows.length} student${
          students.rows.length === 1 ? '' : 's'
        }`}
        breadcrumbs={[{ label: 'Classes', href: '/classes' }, { label: klass.name }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {klass.active ? null : <Badge tone="muted">Archived</Badge>}
            {canWrite ? (
              <Link
                href={`/classes/${klass.id}/edit`}
                className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
              >
                Edit
              </Link>
            ) : null}
            <Link
              href="/classes"
              className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
            >
              Back to classes
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader title="Setup" />
            <dl className="grid gap-4 sm:grid-cols-3">
              <DetailField label="Grade" value={m2oLabel(klass.grade_id)} />
              <DetailField label="Section" value={m2oLabel(klass.section_id)} />
              <DetailField label="Stream" value={m2oLabel(klass.stream_id)} />
              <DetailField
                label="Education level"
                value={formatSelection(klass.education_level)}
              />
              <DetailField label="Campus" value={m2oLabel(klass.campus_id)} />
              <DetailField label="Room" value={m2oLabel(klass.room_id)} />
              <DetailField label="Shift" value={m2oLabel(klass.shift_id)} />
              <DetailField
                label="Homeroom teacher"
                value={m2oLabel(klass.homeroom_teacher_id)}
              />
              <DetailField
                label="Capacity"
                value={klass.capacity ? String(klass.capacity) : 'Unlimited'}
              />
              <DetailField
                label="Age range"
                value={
                  klass.min_age || klass.max_age
                    ? `${klass.min_age || '—'} to ${klass.max_age || '—'}`
                    : 'Not restricted'
                }
              />
              <DetailField
                label="Entry level"
                value={klass.is_entry_level ? 'Yes — no previous-grade document' : 'No'}
              />
            </dl>
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Curriculum"
                hint="Set on the configuration page, which writes the whole subject list at once."
              />
            </div>
            {curriculum.rows.length === 0 ? (
              <EmptyState
                title="No subjects on this class"
                hint="Assessments cannot be created until the class has a curriculum."
              />
            ) : (
              <DataTable columns={['Subject', 'Type', 'Pass', 'Maximum']}>
                {curriculum.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>{m2oLabel(row.subject_id)}</Cell>
                    <Cell>{formatSelection(row.subject_type)}</Cell>
                    <Cell numeric>{row.pass_mark}</Cell>
                    <Cell numeric>{row.maximum_mark}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader title="Students" />
            </div>
            {students.rows.length === 0 ? (
              <EmptyState title="No students in this class" />
            ) : (
              <DataTable columns={['Student', 'Student ID', 'Status']}>
                {students.rows.map((row) => (
                  <Row key={row.id}>
                    <Cell strong>
                      <Link href={`/students/${row.id}`} className="hover:text-action-blue">
                        {row.name}
                      </Link>
                    </Cell>
                    <Cell>{row.regno || '—'}</Cell>
                    <Cell>{formatSelection(row.registration_status)}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Timetable"
                hint={`${schedule.rows.length} period${schedule.rows.length === 1 ? '' : 's'}`}
              />
            </div>
            {schedule.rows.length === 0 ? (
              <EmptyState
                title="No timetable yet"
                hint="Build a day from the schedule page."
              />
            ) : (
              <DataTable columns={['Day', 'Subject']}>
                {schedule.rows.slice(0, 10).map((row) => (
                  <Row key={row.id}>
                    <Cell>{formatSelection(row.day_of_week)}</Cell>
                    <Cell>{m2oLabel(row.subject_id)}</Cell>
                  </Row>
                ))}
              </DataTable>
            )}
            <div className="border-t border-silver p-6">
              <Link
                href={`/schedule?class=${klass.id}`}
                className="text-[13px] text-action-blue hover:underline"
              >
                Open the full timetable
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
