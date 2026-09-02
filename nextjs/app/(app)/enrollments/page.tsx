import Link from 'next/link'
import { formatDate } from '@/lib/format'
import {
  StatusBadge,
} from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listEnrollments } from '@/lib/odoo/models/student'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Enrolments · Async School' }


export default function EnrollmentsPage() {
  return (
    <ResourceList
      title="Enrolments"
      subtitle="One active enrolment per student per academic year — enforced by Odoo."
      load={() => listEnrollments({ limit: 50 })}
      columns={['Enrolment', 'Student', 'Class', 'Year', 'Roll', 'From', 'Status']}
      emptyTitle="No enrolments visible"
      emptyHint="Teachers see enrolments for their own classes only."
      renderRow={(row) => (
        <>
          <Cell strong>
            <Link href={`/enrollments/${row.id}`} className="hover:text-action-blue">
              {row.name}
            </Link>
          </Cell>
          <Cell>{m2oLabel(row.student_id)}</Cell>
          <Cell>{m2oLabel(row.class_id)}</Cell>
          <Cell>{m2oLabel(row.academic_year_id)}</Cell>
          <Cell numeric>{row.roll_number || '—'}</Cell>
          <Cell>{formatDate(row.enrollment_date)}</Cell>
          <Cell>
            <StatusBadge state={row.state} />
          </Cell>
        </>
      )}
    />
  )
}
