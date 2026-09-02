import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import {
  DASH,
  formatDate,
  formatDateTime,
  formatEthiopianDate,
  formatEthiopianDateTime,
  type OdooValue,
} from '@/lib/format'
import { statusMeta, type StatusTone } from '@/lib/status'

/*
  Surfaces, controls and chips.

  Built to design.md: pill buttons, 12px cards separated by shadow rather than
  border, 8px inputs, monochrome throughout with Action Blue reserved for
  informational emphasis. The one place hue is allowed is the status chip —
  see the note at the top of app/globals.css.
*/

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

/* ---------------------------------------------------------------- Card --- */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <div
      className={cx(
        'rounded-[12px] bg-white shadow-[var(--shadow-card)]',
        padded && 'p-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: IconName
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] bg-paper text-slate">
            <Icon name={icon} size={14} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-[16px] leading-tight">{title}</h2>
          {hint ? <p className="mt-1 text-[12px] text-slate">{hint}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/**
 * A card whose body is a table: the header keeps the 24px padding, the table
 * runs to the card edge. Every list-inside-a-card on the site used to hand-roll
 * this as `<Card padded={false}><div className="p-6 pb-0">`.
 */
export function TableCard({
  title,
  hint,
  action,
  icon,
  footer,
  children,
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: IconName
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <Card padded={false}>
      <div className="p-6 pb-0">
        <CardHeader title={title} hint={hint} action={action} icon={icon} />
      </div>
      {children}
      {footer}
    </Card>
  )
}

/* -------------------------------------------------------------- Button --- */

export type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'quiet'
export type ButtonSize = 'sm' | 'md'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-graphite',
  ghost: 'bg-white text-graphite border border-silver hover:bg-paper',
  danger: 'bg-transparent text-danger border border-danger/30 hover:bg-danger-bg',
  quiet: 'bg-transparent text-slate hover:bg-paper hover:text-graphite',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-[12px]',
  md: 'px-5 py-2.5 text-[13px]',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-[9999px] font-medium ' +
  'transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  type = 'button',
  icon,
  pending,
  className,
  ...rest
}: {
  children: ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  /** Shows a working state and blocks a second submission. */
  pending?: boolean
  className?: string
} & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type={type}
      disabled={rest.disabled || pending}
      aria-busy={pending || undefined}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...rest}
    >
      {icon && !pending ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {pending ? <Spinner /> : null}
      {children}
    </button>
  )
}

/** The same shape as Button, for navigation rather than submission. */
export function LinkButton({
  children,
  href,
  variant = 'ghost',
  size = 'md',
  icon,
  className,
  ...rest
}: {
  children: ReactNode
  href: ComponentProps<typeof Link>['href']
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  className?: string
} & Omit<ComponentProps<typeof Link>, 'href' | 'children' | 'className'>) {
  return (
    <Link
      href={href}
      className={cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className)}
      {...rest}
    >
      {icon ? <Icon name={icon} size={size === 'sm' ? 13 : 15} /> : null}
      {children}
    </Link>
  )
}

/**
 * A control whose only label is its icon. It takes a required `label`, which
 * becomes both the accessible name and the tooltip — there is no way to render
 * one of these without naming it.
 */
export function IconButton({
  icon,
  label,
  variant = 'quiet',
  className,
  ...rest
}: {
  icon: IconName
  label: string
  variant?: ButtonVariant
  className?: string
} & Omit<ComponentProps<'button'>, 'children'>) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx(
        'inline-flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={16} />
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        'inline-block h-3.5 w-3.5 animate-spin rounded-full',
        'border-[1.5px] border-current border-t-transparent opacity-70',
        className,
      )}
    />
  )
}

/* --------------------------------------------------------------- Badge --- */

/**
 * The neutral chip, for anything that is not a workflow state — a count, a
 * category, a "Primary" marker. States use StatusBadge.
 */
type BadgeTone = 'neutral' | 'solid' | 'live' | 'muted'

const BADGE_STYLES: Record<BadgeTone, string> = {
  neutral: 'bg-paper text-graphite',
  solid: 'bg-ink text-white',
  live: 'bg-info-bg text-action-blue',
  muted: 'bg-transparent text-stone border border-silver',
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-[9999px] px-2.5 py-0.5',
        'text-[12px] font-medium whitespace-nowrap',
        BADGE_STYLES[tone],
      )}
    >
      {children}
    </span>
  )
}

/* --------------------------------------------------------- StatusBadge --- */

const STATUS_STYLES: Record<StatusTone, { chip: string; dot: string }> = {
  idle: { chip: 'bg-[var(--color-status-idle-bg)] text-[var(--color-status-idle)]', dot: 'bg-[var(--color-status-idle)]' },
  progress: { chip: 'bg-[var(--color-status-progress-bg)] text-[var(--color-status-progress)]', dot: 'bg-[var(--color-status-progress)]' },
  active: { chip: 'bg-[var(--color-status-active-bg)] text-[var(--color-status-active)]', dot: 'bg-[var(--color-status-active)]' },
  done: { chip: 'bg-[var(--color-status-done-bg)] text-[var(--color-status-done)]', dot: 'bg-[var(--color-status-done)]' },
  stopped: { chip: 'bg-[var(--color-status-stopped-bg)] text-[var(--color-status-stopped)]', dot: 'bg-[var(--color-status-stopped)]' },
  muted: { chip: 'border border-silver text-stone', dot: 'bg-stone' },
}

/**
 * A workflow state, drawn the same way everywhere.
 *
 * The word is always present — the dot and the hue reinforce it rather than
 * replace it, so the chip still reads correctly in monochrome, at low contrast
 * and to a screen reader.
 */
export function StatusBadge({
  state,
  model,
  size = 'md',
}: {
  state: unknown
  /** Disambiguates codes that mean different things per model. */
  model?: string
  size?: 'sm' | 'md'
}) {
  const { label, tone } = statusMeta(state, model)
  const style = STATUS_STYLES[tone]
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-[9999px] font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-[12px]',
        style.chip,
      )}
    >
      <span aria-hidden className={cx('h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      {label}
    </span>
  )
}

/* ------------------------------------------------------------ Skeleton --- */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-[8px] bg-silver/60', className)} />
}

/* ------------------------------------------------------------ DateText --- */

/**
 * A date in both calendars: Ethiopian first, Gregorian beneath it.
 *
 * The school works in the Ethiopian calendar, but Odoo stores, validates and
 * displays Gregorian in its own backend, so dropping it would leave anyone
 * cross-checking the two systems guessing. The pair is one component so the
 * whole app changes together if that judgement ever changes.
 */
export function DateText({
  value,
  withTime = false,
}: {
  value: OdooValue<string>
  withTime?: boolean
}) {
  const ethiopian = withTime ? formatEthiopianDateTime(value) : formatEthiopianDate(value)
  const gregorian = withTime ? formatDateTime(value) : formatDate(value)

  if (ethiopian === DASH) return <span className="text-stone">{DASH}</span>

  return (
    <span className="block">
      {ethiopian}
      {gregorian === ethiopian ? null : (
        <span className="block text-[11px] text-stone">{gregorian}</span>
      )}
    </span>
  )
}
