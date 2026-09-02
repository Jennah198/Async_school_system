import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  RestrictedState,
  Stat,
  StatusBadge,
  cx,
} from '@/components/ui'
import { formatCount } from '@/lib/format'
import type { GroupCount } from '@/lib/odoo/models/dashboard'

/*
  The pieces every role dashboard is built from.

  One rule runs through all of them: a panel whose data came back null renders
  as a stated boundary, not as an empty list and never as a zero. Several roles
  legitimately cannot read some models, and "0 students" would be a lie in a
  way that "your role cannot see this" is not.
*/

/** A tile whose value may be a number, or null because Odoo refused the read. */
export function CountTile({
  label,
  value,
  icon,
  href,
  hint,
}: {
  label: string
  value: number | null
  icon?: IconName
  href?: string
  hint?: string
}) {
  return (
    <Stat
      label={label}
      value={value === null ? '—' : formatCount(value)}
      icon={icon}
      href={value === null ? undefined : href}
      hint={value === null ? 'Not available to your role' : hint}
    />
  )
}

export function TileGrid({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>
}

/**
 * A dashboard panel. `data` being null is the refusal case and is handled here
 * so no dashboard has to remember to.
 */
export function Panel({
  title,
  hint,
  icon,
  href,
  hrefLabel = 'View all',
  restricted,
  empty,
  children,
  className,
}: {
  title: string
  hint?: string
  icon?: IconName
  href?: string
  hrefLabel?: string
  /** True when Odoo refused the read for this role. */
  restricted?: boolean
  /** Rendered when the panel has nothing to show. */
  empty?: { title: string; hint?: string; icon?: IconName }
  children?: ReactNode
  className?: string
}) {
  return (
    <Card padded={false} className={cx('flex min-w-0 flex-col', className)}>
      <div className="p-5 pb-0">
        <CardHeader
          title={title}
          hint={hint}
          icon={icon}
          action={
            href && !restricted ? (
              <Link
                href={href}
                className="inline-flex items-center gap-1 text-[12px] text-action-blue hover:underline"
              >
                {hrefLabel}
                <Icon name="arrowRight" size={12} />
              </Link>
            ) : undefined
          }
        />
      </div>
      {restricted ? (
        <RestrictedState what={title} />
      ) : empty ? (
        <EmptyState title={empty.title} hint={empty.hint} icon={empty.icon ?? icon} />
      ) : (
        children
      )}
    </Card>
  )
}

/**
 * A grouped aggregate as a row of proportional bars.
 *
 * Chosen over a pie or a donut because the question these answer is "how many
 * are stuck in each state, and which is the biggest pile" — a length is read
 * accurately at a glance where an angle is not, and the exact count sits
 * beside it either way.
 */
export function StateBreakdown({
  groups,
  hrefFor,
}: {
  groups: GroupCount[]
  /** Links each row into the list, already filtered to that state. */
  hrefFor?: (group: GroupCount) => string
}) {
  const total = groups.reduce((sum, group) => sum + group.count, 0)
  if (total === 0) return null

  return (
    <ul className="space-y-2.5 p-5 pt-1">
      {groups.map((group) => {
        const share = Math.round((group.count / total) * 100)
        const row = (
          <>
            <span className="flex items-center justify-between gap-3 text-[13px]">
              <StatusBadge state={group.value} size="sm" />
              <span className="tabular text-graphite">
                {formatCount(group.count)}
                <span className="ml-1.5 text-[11px] text-stone">{share}%</span>
              </span>
            </span>
            <span
              aria-hidden
              className="mt-1.5 block h-1 overflow-hidden rounded-full bg-silver/70"
            >
              <span
                className="block h-full rounded-full bg-graphite/70"
                style={{ width: `${Math.max(share, 2)}%` }}
              />
            </span>
          </>
        )

        return (
          <li key={group.value}>
            {hrefFor ? (
              <Link href={hrefFor(group)} className="block rounded-[8px] p-1 -m-1 hover:bg-paper/70">
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The things this person is expected to do next.
 *
 * Only rendered for counts Odoo actually returned, and a zero is dropped
 * rather than shown — "0 documents to verify" is not a task.
 */
export function ActionList({
  items,
}: {
  items: Array<{
    label: string
    count: number | null
    href: string
    icon: IconName
  }>
}) {
  const live = items.filter((item) => item.count !== null && item.count > 0)

  if (live.length === 0) {
    return (
      <EmptyState
        icon="check"
        title="Nothing waiting on you"
        hint="Anything needing your approval or attention will appear here."
      />
    )
  }

  return (
    <ul className="space-y-1 p-5 pt-1">
      {live.map((item) => (
        <li key={item.href}>
          <Link
            href={item.href}
            className="flex items-center gap-3 rounded-[8px] px-2.5 py-2.5 transition-colors hover:bg-paper"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-paper text-slate">
              <Icon name={item.icon} size={15} />
            </span>
            <span className="min-w-0 flex-1 text-[13px] text-graphite">{item.label}</span>
            <span className="tabular text-[15px] font-medium text-graphite">
              {formatCount(item.count as number)}
            </span>
            <Icon name="chevronRight" size={13} className="shrink-0 text-silver" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The heading block every dashboard opens with. */
export function DashboardGreeting({
  name,
  role,
  department,
  action,
}: {
  name: string
  role: string
  department?: string
  action?: ReactNode
}) {
  const firstName = name.split(' ').filter(Boolean)[0] ?? name
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] leading-tight">
          {part}, {firstName}
        </h1>
        <p className="mt-1.5 text-[13px] text-slate">
          {role}
          {department ? ` · ${department}` : ''}
        </p>
      </div>
      {action}
    </header>
  )
}

/** A shortcut row, for the things a role reaches for constantly. */
export function QuickLinks({
  links,
}: {
  links: Array<{ href: string; label: string; icon: IconName }>
}) {
  if (links.length === 0) return null
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {links.map((link) => (
        <LinkButton key={link.href} href={link.href} icon={link.icon} size="sm">
          {link.label}
        </LinkButton>
      ))}
    </div>
  )
}
