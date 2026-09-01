import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listTeachers } from '@/lib/odoo/models/school'

export const metadata = { title: 'Teachers · Async School' }

export default function TeachersPage() {
  return (
    <ResourceList
      title="Teachers"
      subtitle="Workload figures are computed by Odoo from active assignments."
      load={() => listTeachers({ limit: 50 })}
      columns={['Name', 'Teacher ID', 'Classes', 'Subjects', 'Students', 'Periods/wk', 'Status']}
      emptyTitle="No teacher profiles visible"
      renderRow={(row) => (
        <>
          <Cell strong>{row.name}</Cell>
          <Cell>{row.teacher_id || '—'}</Cell>
          <Cell numeric>{row.assigned_class_count}</Cell>
          <Cell numeric>{row.assigned_subject_count}</Cell>
          <Cell numeric>{row.total_student_count}</Cell>
          <Cell numeric>{row.current_weekly_periods}</Cell>
          <Cell>
            <Badge tone={row.teaching_status === 'active' ? 'live' : 'muted'}>
              {String(row.teaching_status || '—')}
            </Badge>
          </Cell>
        </>
      )}
    />
  )
}
