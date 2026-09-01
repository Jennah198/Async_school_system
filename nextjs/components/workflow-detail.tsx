import type { ReactNode } from 'react'
import {
  Card,
  CardHeader,
  DetailGrid,
  LinkButton,
  Note,
  PageHeader,
  StatusBadge,
  type Crumb,
} from '@/components/ui'
import { WorkflowPanel } from '@/components/workflow-panel'
import { availableTransitions, type WorkflowKey } from '@/lib/odoo/workflows'

/**
 * The shape every record page shares: details on the left, Odoo's available
 * transitions on the right.
 *
 * The transition list is computed on the server from the record's current
 * state, and only `{key,label,confirm,destructive,requiresReason}` crosses to
 * the client — never a model or a method name.
 */

export function WorkflowDetail({
  title,
  subtitle,
  backHref,
  backLabel,
  workflow,
  id,
  state,
  canWrite,
  fields,
  revalidate,
  note,
  breadcrumbs,
  meta,
  children,
}: {
  title: string
  subtitle?: string
  backHref: string
  backLabel: string
  workflow: WorkflowKey
  id: number
  state: string
  canWrite: boolean
  fields: Array<{ label: string; value: ReactNode }>
  revalidate: string[]
  note?: string
  breadcrumbs?: Crumb[]
  /** Chips beside the page title. */
  meta?: ReactNode
  /** Extra cards rendered beneath the detail grid. */
  children?: ReactNode
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={breadcrumbs}
        meta={meta}
        action={
          <LinkButton href={backHref} icon="arrowLeft">
            {backLabel}
          </LinkButton>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <DetailGrid fields={fields} />
          </Card>
          {children}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <div className="mb-4">
              <StatusBadge state={state} />
            </div>
            <WorkflowPanel
              workflow={workflow}
              id={id}
              transitions={availableTransitions(workflow, state).map(
                ({ key, label, confirm, destructive, requiresReason }) => ({
                  key,
                  label,
                  confirm,
                  destructive,
                  requiresReason,
                }),
              )}
              revalidate={revalidate}
              canWrite={canWrite}
            />
            {note ? <Note>{note}</Note> : null}
          </Card>
        </div>
      </div>
    </>
  )
}
