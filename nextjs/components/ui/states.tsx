import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/icons'
import { Card, LinkButton, Skeleton, cx } from './primitives'

/*
  Loading, empty and error — the three states every data screen has to answer
  for, and the ones a database-shaped UI usually forgets.

  The rule they follow: say what happened, and where it is actionable, say what
  to do next. "No students found" alone leaves somebody wondering whether the
  system is broken; "…try a different name, or register one" does not.
*/

/* ----------------------------------------------------------------- Empty --- */

export function EmptyState({
  title,
  hint,
  icon,
  action,
}: {
  title: string
  hint?: string
  icon?: IconName
  action?: ReactNode
}) {
  return (
    <div className="px-6 py-14 text-center">
      {icon ? (
        <span className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-stone">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <p className="text-[14px] font-medium text-graphite">{title}</p>
      {hint ? <p className="mx-auto mt-1.5 max-w-sm text-[12px] text-slate">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  )
}

/**
 * The specific empty state for "Odoo refused this read".
 *
 * Several roles legitimately cannot see some models — that is the backend
 * working, not a fault — so it is worded as a boundary rather than a failure,
 * and it never suggests a way around it.
 */
export function RestrictedState({ what = 'This information' }: { what?: string }) {
  return (
    <EmptyState
      icon="alert"
      title="Not available to your role"
      hint={`${what} is restricted by the school system's own permissions. Ask an administrator if you need access.`}
    />
  )
}

/* ----------------------------------------------------------------- Error --- */

/**
 * Rendered whenever an Odoo call fails.
 *
 * It receives an already-normalised code and message — Odoo's `debug` field,
 * which carries the Python traceback, is dropped in lib/odoo/errors.ts and
 * never reaches this component.
 */
export function ErrorState({
  code,
  message,
  retryHref,
}: {
  code: string
  message: string
  /** Where "Try again" should point. Usually the current route. */
  retryHref?: string
}) {
  const permission = code === 'FORBIDDEN'
  const transient = code === 'TIMEOUT' || code === 'UPSTREAM_UNAVAILABLE'

  return (
    <Card className="border border-danger/15 bg-danger-bg shadow-none">
      <div className="flex gap-3">
        <span className="mt-0.5 shrink-0 text-danger">
          <Icon name={permission ? 'alert' : 'info'} size={18} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-danger">
            {permission ? 'Not available to your role' : 'Something went wrong'}
          </p>
          <p className="mt-1 text-[13px] text-graphite">{message}</p>
          {transient && retryHref ? (
            <LinkButton href={retryHref} size="sm" icon="refresh" className="mt-3 bg-white">
              Try again
            </LinkButton>
          ) : null}
        </div>
      </div>
    </Card>
  )
}

/* --------------------------------------------------------------- Loading --- */

/**
 * A table's loading shape.
 *
 * The column count is passed in so the skeleton occupies the same width as the
 * table it precedes and the page does not jump when the data lands.
 */
export function TableSkeleton({ columns = 5, rows = 6 }: { columns?: number; rows?: number }) {
  return (
    <div className="px-4 py-3" aria-hidden>
      <div className="flex gap-4 border-b border-silver pb-3">
        {Array.from({ length: columns }, (_, index) => (
          <Skeleton key={index} className="h-2.5 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="flex gap-4 border-b border-silver/70 py-3.5 last:border-0">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton
              key={index}
              className={cx('h-3 flex-1', index === 0 && 'max-w-[40%]')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** The loading shape of a whole list route: header, toolbar, table. */
export function ListSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <div className="mb-6">
        <Skeleton className="h-6 w-52" />
        <Skeleton className="mt-2 h-3 w-72" />
      </div>
      <Card padded={false}>
        <div className="border-b border-silver p-4">
          <Skeleton className="h-8 w-full max-w-sm" />
        </div>
        <TableSkeleton columns={columns} />
      </Card>
    </div>
  )
}

/** The loading shape of a record page: details on the left, status on the right. */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <div className="mb-6">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-3 w-80" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <Skeleton className="mb-5 h-4 w-24" />
          <div className="grid gap-5 sm:grid-cols-3">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index}>
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <Skeleton className="mb-4 h-4 w-16" />
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="mt-5 h-9 w-full rounded-full" />
          <Skeleton className="mt-2 h-9 w-full rounded-full" />
        </Card>
      </div>
    </div>
  )
}

/** The loading shape of a dashboard: a tile row, then two panels. */
export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading">
      <span className="sr-only">Loading</span>
      <div className="mb-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-3 w-64" />
      </div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="mt-3 h-6 w-12" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-6 pb-0">
            <Skeleton className="h-4 w-40" />
          </div>
          <TableSkeleton columns={4} rows={4} />
        </Card>
        <Card padded={false}>
          <div className="p-6 pb-0">
            <Skeleton className="h-4 w-40" />
          </div>
          <TableSkeleton columns={4} rows={4} />
        </Card>
      </div>
    </div>
  )
}
