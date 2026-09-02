import { notFound } from 'next/navigation'
import { Badge, Cell, DataTable, DateText, EmptyState, ErrorState, PageHeader, Row, StatusBadge, TableCard } from '@/components/ui'
import { WorkflowDetail } from '@/components/workflow-detail'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import {
  attendanceBreakdown,
  getReportCard,
  subjectResults,
} from '@/lib/odoo/models/assessment'
import { formatPercent, formatText, trimNumber } from '@/lib/format'
import { statusLabel } from '@/lib/status'
import { m2oLabel } from '@/lib/odoo/types'

export const metadata = { title: 'Report card · Async School' }

/**
 * A published report card is a permanent academic record, and Odoo treats it
 * as one: the subject results are a JSON snapshot frozen at generation, not a
 * live join, so a mark corrected next term cannot silently rewrite a card
 * already issued to a family. Everything below is displayed exactly as Odoo
 * stored it — no percentage, grade or pass mark is recomputed here.
 */
export default async function ReportCardDetailPage({ params }: PageProps<'/report-cards/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let card, canWrite
  try {
    ;[card, canWrite] = await Promise.all([
      getReportCard(id),
      hasAccess('school.report.card', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Report card" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/report-cards" />
      </>
    )
  }
  if (!card) notFound()

  const subjects = subjectResults(card)
  const attendance = attendanceBreakdown(card)
  const attendanceTotal = attendance.reduce((sum, row) => sum + row.count, 0)

  const rank = (position: number, size: number) =>
    position && size ? `${position} of ${size}` : position ? String(position) : '—'

  return (
    <WorkflowDetail
      title={card.name}
      subtitle={`${m2oLabel(card.student_id)} · ${m2oLabel(card.term_id)}`}
      breadcrumbs={[{ label: 'Report cards', href: '/report-cards' }, { label: `Version ${card.version}` }]}
      meta={
        <>
          <Badge tone="neutral">Version {card.version}</Badge>
          {card.result ? (
            <Badge tone={card.result === 'pass' ? 'solid' : 'muted'}>
              {statusLabel(card.result)}
            </Badge>
          ) : null}
        </>
      }
      backHref="/report-cards"
      backLabel="Back to report cards"
      workflow="reportCard"
      id={card.id}
      state={String(card.state || '')}
      canWrite={canWrite}
      revalidate={[`/report-cards/${card.id}`, '/report-cards']}
      note="Approving and publishing are Exam Officer actions, and Odoo re-checks that on every call. Publishing supersedes the previous version rather than replacing it."
      fields={[
        { label: 'Student', value: m2oLabel(card.student_id) },
        { label: 'Class', value: m2oLabel(card.class_id) },
        { label: 'Term', value: m2oLabel(card.term_id) },
        { label: 'Academic year', value: m2oLabel(card.academic_year_id) },
        { label: 'Overall average', value: formatPercent(card.overall_average, 2) },
        { label: 'Result', value: card.result ? statusLabel(card.result) : '—' },
        { label: 'Conduct', value: formatText(card.conduct || undefined) },
        { label: 'Class rank', value: rank(card.class_rank, card.class_size) },
        { label: 'Grade rank', value: rank(card.grade_rank, card.grade_size) },
        { label: 'Grading scheme', value: m2oLabel(card.grading_scheme_id) },
        { label: 'Approved by', value: m2oLabel(card.approved_by_id) },
        { label: 'Approved at', value: <DateText value={card.approved_at} withTime /> },
        { label: 'Published at', value: <DateText value={card.published_at} withTime /> },
        { label: 'Supersedes', value: m2oLabel(card.supersedes_id) },
        { label: 'Superseded by', value: m2oLabel(card.superseded_by_id) },
        { label: 'Correction reason', value: formatText(card.correction_reason) },
      ]}
    >
      <TableCard
        title="Subject results"
        icon="marks"
        hint="Frozen when the card was generated, so a later mark correction cannot rewrite an issued card."
      >
        {subjects.length === 0 ? (
          <EmptyState
            icon="marks"
            title="No subject results on this card"
            hint="A card is generated from the term's published marks; if none were published there is nothing to show."
          />
        ) : (
          <DataTable
            caption="Subject results for this report card"
            columns={[
              { key: 'subject', label: 'Subject' },
              { key: 'score', label: 'Score', numeric: true },
              { key: 'max', label: 'Out of', numeric: true },
              { key: 'pct', label: 'Percentage', numeric: true },
              { key: 'grade', label: 'Grade' },
              { key: 'result', label: 'Result' },
            ]}
          >
            {subjects.map((subject) => (
              <Row key={subject.subject}>
                <Cell strong>{subject.subject}</Cell>
                <Cell numeric>{trimNumber(subject.raw_total)}</Cell>
                <Cell numeric>{trimNumber(subject.maximum_total)}</Cell>
                <Cell numeric>{formatPercent(subject.percentage, 2)}</Cell>
                <Cell>{subject.grade ? <Badge tone="neutral">{subject.grade}</Badge> : '—'}</Cell>
                <Cell>
                  <StatusBadge state={subject.pass ? 'passed' : 'failed'} size="sm" />
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </TableCard>

      <TableCard
        title="Attendance this term"
        icon="attendance"
        hint="Counted by Odoo across the term's dates when the card was generated."
      >
        {attendance.length === 0 ? (
          <EmptyState icon="attendance" title="No attendance recorded for this term" />
        ) : (
          <DataTable
            caption="Attendance summary"
            columns={[
              { key: 'status', label: 'Status' },
              { key: 'days', label: 'Days', numeric: true },
              { key: 'share', label: 'Share', numeric: true },
            ]}
          >
            {attendance.map((row) => (
              <Row key={row.status}>
                <Cell strong>
                  <StatusBadge state={row.status} size="sm" />
                </Cell>
                <Cell numeric>{row.count}</Cell>
                <Cell numeric>
                  {attendanceTotal ? formatPercent((row.count / attendanceTotal) * 100) : '—'}
                </Cell>
              </Row>
            ))}
          </DataTable>
        )}
      </TableCard>

      {card.homeroom_remarks || card.principal_remarks ? (
        <TableCard title="Remarks" icon="documents">
          <dl className="space-y-3 p-6 pt-1 text-[13px]">
            {card.homeroom_remarks ? (
              <div>
                <dt className="text-[11px] tracking-wide text-stone uppercase">Homeroom teacher</dt>
                <dd className="mt-1 text-graphite">{card.homeroom_remarks}</dd>
              </div>
            ) : null}
            {card.principal_remarks ? (
              <div>
                <dt className="text-[11px] tracking-wide text-stone uppercase">Principal</dt>
                <dd className="mt-1 text-graphite">{card.principal_remarks}</dd>
              </div>
            ) : null}
          </dl>
        </TableCard>
      ) : null}
    </WorkflowDetail>
  )
}
