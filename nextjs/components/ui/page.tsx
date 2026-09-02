import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import { Card, cx } from './primitives'

/*
  Page furniture: the heading block, breadcrumbs, the detail grid and the stat
  tile. Every screen composes from these rather than inventing its own header,
  which is what kept twelve pages three pixels out of alignment with each other.
*/

/* ------------------------------------------------------------ Breadcrumb --- */

export interface Crumb {
  label: string
  href?: string
}

export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (trail.length === 0) return null
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1 text-[12px] text-stone">
        {trail.map((crumb, index) => {
          const last = index === trail.length - 1
          return (
            <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {crumb.href && !last ? (
                <Link href={crumb.href} className="hover:text-graphite">
                  {crumb.label}
                </Link>
              ) : (
                <span className={last ? 'text-slate' : undefined} aria-current={last ? 'page' : undefined}>
                  {crumb.label}
                </span>
              )}
              {last ? null : <Icon name="chevronRight" size={11} className="text-silver" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/* ------------------------------------------------------------ PageHeader --- */

export function PageHeader({
  title,
  subtitle,
  action,
  breadcrumbs,
  meta,
}: {
  title: string
  subtitle?: ReactNode
  /** Primary actions for the page, right-aligned. */
  action?: ReactNode
  breadcrumbs?: Crumb[]
  /** Chips beside the title — status, identifiers. */
  meta?: ReactNode
}) {
  return (
    <header className="mb-6">
      {breadcrumbs ? <Breadcrumbs trail={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[24px] leading-tight">{title}</h1>
            {meta}
          </div>
          {subtitle ? <p className="mt-1.5 text-[13px] text-slate">{subtitle}</p> : null}
        </div>
        {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  )
}

/* ------------------------------------------------------------- Stat tile --- */

export function Stat({
  label,
  value,
  hint,
  icon,
  href,
}: {
  label: string
  value: ReactNode
  hint?: string
  icon?: IconName
  /** Makes the whole tile a link into the list it counts. */
  href?: string
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] text-slate">{label}</p>
        {icon ? (
          <span className="text-silver">
            <Icon name={icon} size={15} />
          </span>
        ) : null}
      </div>
      <p className="tabular mt-1.5 font-display text-[24px] leading-none text-graphite">{value}</p>
      {hint ? <p className="mt-2 text-[11px] text-stone">{hint}</p> : null}
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        className={cx(
          'block min-w-0 rounded-[12px] bg-white p-5 shadow-[var(--shadow-card)]',
          'transition-shadow hover:shadow-[var(--shadow-raised)]',
        )}
      >
        {body}
      </Link>
    )
  }
  return <Card className="min-w-0 p-5">{body}</Card>
}

/* ----------------------------------------------------------- Detail grid --- */

export function DetailField({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === '' || value === false
  return (
    <div className="min-w-0">
      <dt className="text-[11px] tracking-wide text-stone uppercase">{label}</dt>
      <dd className="mt-1 text-[13px] break-words text-graphite">{empty ? '—' : value}</dd>
    </div>
  )
}

/** The three-column definition list every record page opens with. */
export function DetailGrid({ fields }: { fields: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {fields.map((field) => (
        <DetailField key={field.label} label={field.label} value={field.value} />
      ))}
    </dl>
  )
}

/**
 * A short note under a panel explaining what Odoo does on the user's behalf.
 * Used often enough — "activation allocates the roll number", "publishing
 * supersedes the previous version" — to be worth one shape.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex gap-2 border-t border-silver pt-3 text-[11px] leading-relaxed text-stone">
      <Icon name="info" size={13} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  )
}
