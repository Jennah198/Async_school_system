import { Badge } from '@/components/ui'
import { Cell, ResourceList } from '@/components/resource-list'
import { listMarks } from '@/lib/odoo/models/school'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Marks · Async School' }

/**
 * `percentage` and `grade` are read straight from Odoo, which applies the
 * configured grading scheme and its bands. The formula is never reimplemented
 * here — if Odoo computes a grade, this displays Odoo's result.
 */
export default function MarksPage() {
  return (
    <ResourceList
      title="Marks"
      subtitle="Percentages and grades are computed by Odoo's grading scheme."
      load={() => listMarks({ limit: 100 })}
      columns={[
        'Student',
        'Subject',
        'Class',
        'Assessment',
        'Score',
        'Out of',
        'Percent',
        'Grade',
        'Status',
      ]}
      emptyTitle="No marks visible"
      emptyHint="A teacher sees marks for their own exact assignment only."
      renderRow={(row) => (
        <>
          <Cell strong>{m2oLabel(row.student_id)}</Cell>
          <Cell>{m2oLabel(row.subject_id)}</Cell>
          <Cell>{m2oLabel(row.class_id)}</Cell>
          <Cell>{String(row.exam_type || '—')}</Cell>
          <Cell numeric>{row.score}</Cell>
          <Cell numeric>{row.max_score}</Cell>
          <Cell numeric>{row.percentage != null ? row.percentage.toFixed(1) : '—'}</Cell>
          <Cell>
            <Badge tone="neutral">{row.grade || '—'}</Badge>
          </Cell>
          <Cell>{String(row.mark_status || '—').replace(/_/g, ' ')}</Cell>
        </>
      )}
    />
  )
}
