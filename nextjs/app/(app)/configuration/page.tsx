import {
  Card,
  CardHeader,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { toOdooError } from '@/lib/odoo/errors'
import { listConfig, listCurriculum, listTerms, type SimpleRow } from '@/lib/odoo/models/operations'
import { m2oLabel, type Many2one } from '@/lib/odoo/types'
import type { Page } from '@/lib/odoo/types'

export const metadata = { title: 'Configuration · Async School' }

/**
 * The academic vocabularies every picker draws on: grades, sections, streams,
 * shifts, campuses, rooms, terms and the class curriculum.
 *
 * Each block degrades on its own — several are readable only by some roles, so
 * one refusal must not take the page down.
 */

function VocabularyCard({
  title,
  hint,
  head,
  rows,
  render,
}: {
  title: string
  hint?: string
  head: string[]
  rows: Page<SimpleRow> | null
  render: (row: SimpleRow) => React.ReactNode
}) {
  return (
    <Card padded={false}>
      <div className="p-6 pb-0">
        <CardHeader title={title} hint={hint} />
      </div>
      {rows === null ? (
        <EmptyState title="Not available to your role" />
      ) : rows.rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} recorded`} />
      ) : (
        <DataTable head={head}>
          {rows.rows.map((row) => (
            <Row key={row.id}>{render(row)}</Row>
          ))}
        </DataTable>
      )}
    </Card>
  )
}

const time = (value: unknown) => {
  if (typeof value !== 'number' || value === 0) return '—'
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export default async function ConfigurationPage() {
  let grades, sections, streams, shifts, campuses, rooms, terms, curriculum
  try {
    ;[grades, sections, streams, shifts, campuses, rooms, terms, curriculum] = await Promise.all([
      listConfig('grades'),
      listConfig('sections'),
      listConfig('streams'),
      listConfig('shifts'),
      listConfig('campuses'),
      listConfig('rooms'),
      listTerms(),
      listCurriculum(),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Configuration" />
        <ErrorState {...toOdooError(cause).toClient()} />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Configuration"
        subtitle="The academic structure every other screen draws on. Odoo owns the constraints between these."
      />

      <div className="space-y-4">
        <Card padded={false}>
          <div className="p-6 pb-0">
            <CardHeader
              title="Terms"
              hint="Each term belongs to one academic year and must fall inside it."
            />
          </div>
          {terms.rows.length === 0 ? (
            <EmptyState title="No terms recorded" />
          ) : (
            <DataTable head={['Term', 'Academic year', 'Starts', 'Ends', 'Sequence']}>
              {terms.rows.map((row) => (
                <Row key={row.id}>
                  <Cell strong>{row.name}</Cell>
                  <Cell>{m2oLabel(row.academic_year_id)}</Cell>
                  <Cell>{row.date_start}</Cell>
                  <Cell>{row.date_end}</Cell>
                  <Cell numeric>{row.sequence}</Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <VocabularyCard
            title="Grades"
            hint="Grade 1 to 12, each with a level Odoo uses for the age rule."
            head={['Grade', 'Code', 'Level', 'Active']}
            rows={grades}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell>{String(row.code ?? '—')}</Cell>
                <Cell>{String(row.level ?? '—')}</Cell>
                <Cell>{row.active ? 'Yes' : 'No'}</Cell>
              </>
            )}
          />
          <VocabularyCard
            title="Sections"
            head={['Section', 'Classes', 'Sequence', 'Active']}
            rows={sections}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell numeric>{String(row.class_count ?? 0)}</Cell>
                <Cell numeric>{String(row.sequence ?? '—')}</Cell>
                <Cell>{row.active ? 'Yes' : 'No'}</Cell>
              </>
            )}
          />
          <VocabularyCard
            title="Streams"
            hint="Available to Grades 11 and 12 only — Odoo enforces that."
            head={['Stream', 'Code', 'Active']}
            rows={streams}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell>{String(row.code ?? '—')}</Cell>
                <Cell>{row.active ? 'Yes' : 'No'}</Cell>
              </>
            )}
          />
          <VocabularyCard
            title="Shifts"
            head={['Shift', 'Code', 'Starts', 'Ends']}
            rows={shifts}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell>{String(row.code ?? '—')}</Cell>
                <Cell numeric>{time(row.time_start)}</Cell>
                <Cell numeric>{time(row.time_end)}</Cell>
              </>
            )}
          />
          <VocabularyCard
            title="Campuses"
            head={['Campus', 'Code', 'Active']}
            rows={campuses}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell>{String(row.code ?? '—')}</Cell>
                <Cell>{row.active ? 'Yes' : 'No'}</Cell>
              </>
            )}
          />
          <VocabularyCard
            title="Rooms"
            head={['Room', 'Code', 'Type', 'Capacity']}
            rows={rooms}
            render={(row) => (
              <>
                <Cell strong>{String(row.name)}</Cell>
                <Cell>{String(row.code ?? '—')}</Cell>
                <Cell>{String(row.room_type ?? '—')}</Cell>
                <Cell numeric>{String(row.capacity ?? '—')}</Cell>
              </>
            )}
          />
        </div>

        <Card padded={false}>
          <div className="p-6 pb-0">
            <CardHeader
              title="Curriculum"
              hint="What each class studies. Subject enrolments are derived from these when an enrolment activates."
            />
          </div>
          {curriculum.rows.length === 0 ? (
            <EmptyState title="No curriculum recorded" />
          ) : (
            <DataTable head={['Class', 'Subject', 'Type', 'Maximum', 'Pass mark', 'Active']}>
              {curriculum.rows.map((row) => (
                <Row key={row.id}>
                  <Cell strong>{m2oLabel(row.class_id as Many2one)}</Cell>
                  <Cell>{m2oLabel(row.subject_id as Many2one)}</Cell>
                  <Cell>{String(row.subject_type || '—').replace(/_/g, ' ')}</Cell>
                  <Cell numeric>{row.maximum_mark}</Cell>
                  <Cell numeric>{row.pass_mark}</Cell>
                  <Cell>{row.active ? 'Yes' : 'No'}</Cell>
                </Row>
              ))}
            </DataTable>
          )}
        </Card>
      </div>
    </>
  )
}
