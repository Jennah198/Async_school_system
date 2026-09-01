import Link from 'next/link'
import type { ReactNode } from 'react'
import { Badge, Card, CardHeader, PageHeader } from '@/components/ui'
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

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-stone uppercase">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-graphite">{value || '—'}</dd>
    </div>
  )
}

const TONE: Record<string, 'solid' | 'live' | 'muted' | 'neutral'> = {
  published: 'solid',
  verified: 'solid',
  completed: 'solid',
  locked: 'solid',
  done: 'solid',
  active: 'live',
  open: 'live',
  approved: 'live',
  draft: 'muted',
  cancelled: 'muted',
  archived: 'muted',
  rejected: 'muted',
  superseded: 'muted',
  expired: 'muted',
}

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
  /** Extra cards rendered beneath the detail grid. */
  children?: ReactNode
}) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Link
            href={backHref}
            className="rounded-[9999px] border border-silver px-4 py-2 text-[13px] hover:bg-paper"
          >
            {backLabel}
          </Link>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Details" />
            <dl className="grid gap-4 sm:grid-cols-3">
              {fields.map((field) => (
                <DetailField key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
          </Card>
          {children}
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" />
            <div className="mb-4">
              <Badge tone={TONE[state] ?? 'neutral'}>{state || '—'}</Badge>
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
            {note ? (
              <p className="mt-4 border-t border-silver pt-3 text-[11px] text-stone">{note}</p>
            ) : null}
          </Card>
        </div>
      </div>
    </>
  )
}
