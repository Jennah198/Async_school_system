import Link from 'next/link'
import {
  Badge,
  Card,
  CardHeader,
  Cell,
  DataTable,
  EmptyState,
  ErrorState,
  PageHeader,
  Row,
} from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listGradingSchemes } from '@/lib/odoo/models/grading'
import { SchemeCreateForm } from './scheme-form'

export const metadata = { title: 'Grading schemes · Async School' }

export default async function GradingSchemesPage() {
  let schemes, canCreate
  try {
    ;[schemes, canCreate] = await Promise.all([
      listGradingSchemes(),
      hasAccess('school.grading.scheme', 'create'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Grading schemes" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration" />
      </>
    )
  }

  const active = schemes?.rows.find((scheme) => scheme.is_company_scheme)

  return (
    <>
      <PageHeader
        title="Grading schemes"
        subtitle="The bands that turn a percentage into a grade. One scheme is the school's active one; until there is, Odoo refuses to publish an assessment or generate a report card."
        breadcrumbs={[{ label: 'Configuration', href: '/configuration' }, { label: 'Grading' }]}
      />

      <div className="space-y-4">
        {schemes === null ? (
          <Card>
            <EmptyState title="Not available to your role" />
          </Card>
        ) : (
          <Card padded={false}>
            <div className="p-6 pb-0">
              <CardHeader
                title="Schemes"
                hint={
                  active
                    ? `Report cards are graded by ${active.name}.`
                    : 'No scheme is in use yet, so publishing and report cards are blocked.'
                }
              />
            </div>

            {schemes.rows.length === 0 ? (
              <EmptyState
                title="No grading scheme yet"
                hint="Create one below. The bands have to cover every percentage from 0 through 100."
              />
            ) : (
              <DataTable columns={['Scheme', 'Pass mark', 'Bands', 'Status']}>
                {schemes.rows.map((scheme) => (
                  <Row key={scheme.id}>
                    <Cell strong>
                      <Link
                        href={`/configuration/grading/${scheme.id}`}
                        className="hover:text-action-blue"
                      >
                        {scheme.name}
                      </Link>
                    </Cell>
                    <Cell numeric>{scheme.pass_percentage}%</Cell>
                    <Cell numeric>{scheme.band_ids.length}</Cell>
                    <Cell>
                      <div className="flex flex-wrap gap-1.5">
                        {scheme.is_company_scheme ? <Badge tone="solid">In use</Badge> : null}
                        {scheme.active ? null : <Badge tone="muted">Retired</Badge>}
                      </div>
                    </Cell>
                  </Row>
                ))}
              </DataTable>
            )}
          </Card>
        )}

        {canCreate ? (
          <Card>
            <CardHeader
              title="New scheme"
              hint="Bands may touch at a boundary but not overlap, and together they must leave no percentage uncovered."
            />
            <SchemeCreateForm />
          </Card>
        ) : null}
      </div>
    </>
  )
}
