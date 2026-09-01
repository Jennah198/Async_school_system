import type { ReactNode } from 'react'

/*
  Primitives for the school ERP, built to design.md:
  solid Ink or ghost pill buttons, 12px cards separated by shadow rather than
  border, 8px inputs, monochrome throughout with Action Blue reserved for
  informational emphasis.
*/

function cx(...parts: Array<string | false | undefined>): string {
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

export function CardHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[20px] leading-tight">{title}</h2>
        {hint ? <p className="mt-1 text-[12px] text-slate">{hint}</p> : null}
      </div>
      {action}
    </div>
  )
}

/* -------------------------------------------------------------- Button --- */

type ButtonVariant = 'primary' | 'ghost' | 'danger'

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-graphite',
  ghost: 'bg-transparent text-graphite border border-silver hover:bg-paper',
  danger: 'bg-transparent text-danger border border-danger/30 hover:bg-danger-bg',
}

export function Button({
  children,
  variant = 'primary',
  type = 'button',
  disabled,
  className,
  ...rest
}: {
  children: ReactNode
  variant?: ButtonVariant
  className?: string
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-[9999px] px-5 py-2.5',
        'text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_STYLES[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/* --------------------------------------------------------------- Badge --- */

/*
  design.md forbids introducing colour, so state is carried by fill and weight
  rather than hue: a filled chip reads as terminal/authoritative, an outlined
  one as in-progress, and Action Blue marks the single "live now" state.
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

/* --------------------------------------------------------------- State --- */

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-graphite">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-[12px] text-slate">{hint}</p> : null}
    </div>
  )
}

/**
 * Rendered whenever an Odoo call fails. It receives an already-normalised
 * code and message — Odoo's `debug` traceback never reaches this component.
 */
export function ErrorState({ code, message }: { code: string; message: string }) {
  const isPermission = code === 'FORBIDDEN'
  return (
    <div className="rounded-[12px] bg-danger-bg px-5 py-4">
      <p className="text-[14px] font-medium text-danger">
        {isPermission ? 'Not available to your role' : 'Something went wrong'}
      </p>
      <p className="mt-1 text-[13px] text-graphite">{message}</p>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-[8px] bg-silver/60', className)} />
}

/* ------------------------------------------------------------ Page head --- */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] leading-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-[14px] text-slate">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  )
}

/* ----------------------------------------------------------- Stat tile --- */

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="min-w-0">
      <p className="text-[12px] text-slate">{label}</p>
      <p className="tabular mt-1 font-display text-[24px] leading-none text-graphite">{value}</p>
      {hint ? <p className="mt-1.5 text-[12px] text-stone">{hint}</p> : null}
    </Card>
  )
}

/* ---------------------------------------------------------------- Table --- */

export function DataTable({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            {head.map((label) => (
              <th
                key={label}
                className="border-b border-silver px-4 py-2.5 text-left text-[11px] font-medium tracking-wide text-slate uppercase whitespace-nowrap"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-b border-silver/70 last:border-0 hover:bg-paper/60">{children}</tr>
}

export function Cell({
  children,
  numeric,
  strong,
}: {
  children: ReactNode
  numeric?: boolean
  strong?: boolean
}) {
  return (
    <td
      className={cx(
        'px-4 py-2.5 align-middle',
        numeric && 'tabular text-right',
        strong ? 'font-medium text-graphite' : 'text-graphite/90',
      )}
    >
      {children}
    </td>
  )
}
