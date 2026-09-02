import { Card, CardHeader, EmptyState, ErrorState, PageHeader } from '@/components/ui'
import { formatSelection } from '@/lib/format'
import { hasAccess } from '@/lib/odoo/client'
import { toOdooError } from '@/lib/odoo/errors'
import { listConfig } from '@/lib/odoo/models/operations'
import { listDocumentRules, listDocumentTypes } from '@/lib/odoo/models/registration'
import { selectionOptions } from '@/lib/odoo/selections'
import { m2oLabel } from '@/lib/odoo/types'
import { DocumentRules } from './rules'

export const metadata = { title: 'Document rules · Async School' }

export default async function DocumentRulesPage() {
  let rules, types, admissionTypes, streams, canWrite
  try {
    ;[rules, types, admissionTypes, streams, canWrite] = await Promise.all([
      listDocumentRules(),
      listDocumentTypes(),
      selectionOptions('school.document.rule', 'admission_type'),
      listConfig('streams'),
      hasAccess('school.document.rule', 'write'),
    ])
  } catch (cause) {
    return (
      <>
        <PageHeader title="Document rules" />
        <ErrorState {...toOdooError(cause).toClient()} retryHref="/configuration" />
      </>
    )
  }

  const blocking = (rules?.rows ?? []).filter((r) => r.required && r.active).length

  return (
    <>
      <PageHeader
        title="Document rules"
        subtitle="Which documents a registration must carry before Odoo will let it be submitted."
        breadcrumbs={[
          { label: 'Configuration', href: '/configuration' },
          { label: 'Document rules' },
        ]}
      />

      {rules === null ? (
        <Card>
          <EmptyState title="Not available to your role" />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="p-6 pb-0">
            <CardHeader
              title="Rules"
              hint={
                blocking === 0
                  ? 'Nothing is required beyond the birth certificate the registration form already asks for.'
                  : `${blocking} rule${blocking === 1 ? '' : 's'} must be satisfied before a matching registration can be submitted.`
              }
            />
          </div>
          <DocumentRules
            canWrite={canWrite}
            rules={rules.rows.map((rule) => ({
              id: rule.id,
              documentType: m2oLabel(rule.document_type_id),
              admissionType: formatSelection(rule.admission_type),
              gradeFrom: rule.grade_from,
              gradeTo: rule.grade_to,
              stream: m2oLabel(rule.stream_id),
              required: rule.required,
              active: rule.active,
            }))}
            documentTypes={(types?.rows ?? []).map((t) => ({
              value: String(t.id),
              label: t.name,
            }))}
            admissionTypes={admissionTypes}
            streams={(streams?.rows ?? []).map((s) => ({ value: String(s.id), label: s.name }))}
          />
        </Card>
      )}
    </>
  )
}
