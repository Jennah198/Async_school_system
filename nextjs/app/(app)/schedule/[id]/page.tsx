import { notFound } from 'next/navigation'
import { ErrorState, PageHeader } from '@/components/ui'
import { WorkflowDetail } from '@/components/workflow-detail'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { formatSlotTime, getSchedule, WEEKDAYS } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Timetable slot · Async School' }

export default async function ScheduleDetailPage({ params }: PageProps<'/schedule/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let slot, canWrite
  try {
    ;[slot, canWrite] = await Promise.all([getSchedule(id), hasAccess('school.class.schedule', 'write')])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Timetable slot" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }
  if (!slot) notFound()

  return (
    <WorkflowDetail
      title={`${m2oLabel(slot.subject_id)} · ${m2oLabel(slot.class_id)}`}
      subtitle={`${WEEKDAYS[Number(slot.day_of_week)] ?? ''} ${formatSlotTime(slot.start_time)}–${formatSlotTime(slot.end_time)}`}
      backHref="/schedule"
      backLabel="Back to timetable"
      workflow="schedule"
      id={slot.id}
      state={String(slot.state || '')}
      canWrite={canWrite}
      revalidate={[`/schedule/${slot.id}`, '/schedule']}
      note="Cancelling releases the teacher, class and room for that slot. Odoo blocks any double booking."
      fields={[
        { label: 'Class', value: m2oLabel(slot.class_id) },
        { label: 'Subject', value: m2oLabel(slot.subject_id) },
        { label: 'Teacher', value: m2oLabel(slot.teacher_id) },
        { label: 'Term', value: m2oLabel(slot.term_id) },
        { label: 'Room', value: m2oLabel(slot.room_id) },
        { label: 'Day', value: WEEKDAYS[Number(slot.day_of_week)] ?? '—' },
        { label: 'Starts', value: formatSlotTime(slot.start_time) },
        { label: 'Ends', value: formatSlotTime(slot.end_time) },
        { label: 'Type', value: String(slot.schedule_type || '—') },
      ]}
    />
  )
}
