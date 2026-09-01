import Link from 'next/link'
import type { ReactNode } from 'react'
import { logoutAction } from '@/app/login/actions'
import { primaryRoleLabel, visibleSections } from '@/lib/navigation'
import type { CurrentUser } from '@/lib/odoo/types'
import { SidebarNav } from './sidebar-nav'

/**
 * The authenticated shell: a fixed sidebar and a content column.
 *
 * design.md describes a 1200px centred marketing page; an administrative
 * application is scanned rather than read, so the shell runs full width and
 * the card grid carries the rhythm instead of 96px section gaps.
 */
export function AppShell({ user, children }: { user: CurrentUser; children: ReactNode }) {
  const sections = visibleSections(user.roles)
  const initials = user.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-silver bg-white lg:flex">
        <div className="flex h-14 items-center gap-2.5 px-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-[6px] bg-ink">
            <span className="font-display text-[13px] leading-none text-white">A</span>
          </span>
          <span className="font-display text-[15px] text-graphite">Async School</span>
        </div>

        <SidebarNav sections={sections} />

        <div className="border-t border-silver p-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-medium text-graphite">
              {initials || '—'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-graphite">
                {user.name}
              </span>
              <span className="block truncate text-[11px] text-stone">
                {primaryRoleLabel(user.roles)}
              </span>
            </span>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-[8px] px-2 py-1.5 text-left text-[13px] text-slate hover:bg-paper hover:text-graphite"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-4 border-b border-silver bg-white px-5 lg:px-8">
          <Link href="/dashboard" className="font-display text-[15px] text-graphite lg:hidden">
            Async School
          </Link>
          <div className="hidden lg:block" />
          <span className="text-[12px] text-stone">
            {primaryRoleLabel(user.roles)} · {user.login}
          </span>
        </header>

        {/* Mobile nav: the sidebar is hidden below lg, so surface it inline. */}
        <nav className="flex gap-1 overflow-x-auto border-b border-silver bg-white px-5 py-2 lg:hidden">
          {sections.flatMap((section) =>
            section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-[9999px] px-3 py-1.5 text-[13px] whitespace-nowrap text-slate hover:bg-paper hover:text-graphite"
              >
                {item.label}
              </Link>
            )),
          )}
        </nav>

        <main className="min-w-0 flex-1 px-5 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  )
}
