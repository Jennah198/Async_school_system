import { notFound } from 'next/navigation'
import { Badge, Card, CardHeader, ErrorState, PageHeader } from '@/components/ui'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { coverageGap } from '@/lib/grading-coverage'
import { getGradingScheme, listBands } from '@/lib/odoo/models/grading'
import { SchemeBands } from './scheme-bands'

export const metadata = { title: 'Grading scheme · Async School' }

export default async function GradingSchemePage({
  params,
}: PageProps<'/configuration/grading/[id]'>) {
  const id = Number((await params).id)
  if (!Number.isFinite(id)) notFound()

  let scheme, bands, canWrite
  try {
    ;[scheme, bands, canWrite] = await Promise.all([
      getGradingScheme(id),
      listBands(id),
      hasAccess('school.grading.scheme', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Grading scheme" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration/grading" />
      </>
    )
  }

  if (!scheme) notFound()

  const rows = bands?.rows ?? []
  const gap = coverageGap(rows)

  return (
    <>
      <PageHeader
        title={scheme.name}
        subtitle={`Pass mark ${scheme.pass_percentage}% · ${rows.length} band${
          rows.length === 1 ? '' : 's'
        }`}
        breadcrumbs={[
          { label: 'Configuration', href: '/configuration' },
          { label: 'Grading', href: '/configuration/grading' },
          { label: scheme.name },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            {scheme.is_company_scheme ? <Badge tone="solid">In use</Badge> : null}
            {scheme.active ? null : <Badge tone="muted">Retired</Badge>}
          </div>
        }
      />

      <Card padded={false} className="max-w-4xl">
        <div className="p-6 pb-0">
          <CardHeader
            title="Bands"
            hint="A percentage is graded by the band whose range contains it. Bands may touch at a boundary but not overlap."
          />
        </div>
        <SchemeBands
          schemeId={scheme.id}
          bands={rows.map((band) => ({
            id: band.id,
            name: band.name,
            minimum: band.minimum_percentage,
            maximum: band.maximum_percentage,
            remark: String(band.remark || ''),
          }))}
          coverageProblem={gap}
          isInUse={scheme.is_company_scheme}
          isActive={scheme.active}
          canWrite={canWrite && bands !== null}
        />
      </Card>
    </>
  )
}
