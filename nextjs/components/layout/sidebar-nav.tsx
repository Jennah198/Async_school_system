'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavSection } from '@/lib/navigation'

/**
 * Client component purely so the active route can be highlighted. It receives
 * an already-filtered section list — the decision about what a role may see is
 * made on the server, never here.
 */
export function SidebarNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-2">
      {sections.map((section) => (
        <div key={section.title} className="mb-5">
          <p className="px-2 pb-1.5 text-[10px] font-medium tracking-[0.08em] text-stone uppercase">
            {section.title}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'block rounded-[8px] bg-ink px-2.5 py-1.5 text-[13px] font-medium text-white'
                        : 'block rounded-[8px] px-2.5 py-1.5 text-[13px] text-slate hover:bg-paper hover:text-graphite'
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
