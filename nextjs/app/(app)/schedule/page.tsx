import Link from 'next/link'
import { formatSelection } from '@/lib/format'
import {
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { formatSlotTime, listSchedule, WEEKDAYS } from '@/lib/odoo/models/operations'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Timetable · Async School' }


export default function SchedulePage() {
  return (
    <ResourceList
      title="Timetable"
      subtitle="Recurring weekly slots. Odoo refuses a double booking of a teacher, class or room."
      load={() => listSchedule({ limit: 100 })}
      columns={['Day', 'Time', 'Class', 'Subject', 'Teacher', 'Room', 'Type', 'Status']}
      emptyTitle="No timetable slots visible"
      emptyHint="Teachers see only their own slots."
      renderRow={(row) => (
        <>
          <Cell strong>{WEEKDAYS[Number(row.day_of_week)] ?? '—'}</Cell>
          <Cell numeric>
            {formatSlotTime(row.start_time)}–{formatSlotTime(row.end_time)}
          </Cell>
          <Cell>{m2oLabel(row.class_id)}</Cell>
          <Cell>{m2oLabel(row.subject_id)}</Cell>
          <Cell>{m2oLabel(row.teacher_id)}</Cell>
          <Cell>{m2oLabel(row.room_id)}</Cell>
          <Cell>{formatSelection(row.schedule_type)}</Cell>
          <Cell>
            <Link href={`/schedule/${row.id}`} className="hover:text-action-blue">
              <StatusBadge state={row.state} />
            </Link>
          </Cell>
        </>
      )}
    />
  )
}
