import { Cell, ResourceList } from '@/components/resource-list'
import { listClasses } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Classes · Async School' }

export default function ClassesPage() {
  return (
    <ResourceList
      title="Classes"
      load={() => listClasses({ limit: 50 })}
      columns={['Class', 'Grade', 'Section', 'Academic year', 'Level', 'Enrolled', 'Capacity']}
      emptyTitle="No classes visible"
      renderRow={(row) => (
        <>
          <Cell strong>{row.name}</Cell>
          <Cell>{m2oLabel(row.grade_id)}</Cell>
          <Cell>{m2oLabel(row.section_id)}</Cell>
          <Cell>{m2oLabel(row.academic_year_id)}</Cell>
          <Cell>{String(row.education_level || '—').replace(/_/g, ' ')}</Cell>
          <Cell numeric>{row.student_ids.length}</Cell>
          <Cell numeric>{row.capacity || 'Unlimited'}</Cell>
        </>
      )}
    />
  )
}
