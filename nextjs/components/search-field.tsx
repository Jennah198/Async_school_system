'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

/**
 * Debounced search that pushes the term into the URL, so the server component
 * re-runs the query against Odoo. Filtering never happens client-side — the
 * row set is scoped by record rules and paged, so the browser only ever holds
 * one page.
 */
export function SearchField({ placeholder = 'Search' }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get('q') ?? '')
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const current = params.get('q') ?? ''
    if (value === current) return

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (value) next.set('q', value)
      else next.delete('q')
      next.delete('page') // a new search starts at the first page
      startTransition(() => router.replace(`${pathname}?${next}`))
    }, 300)

    return () => clearTimeout(timer)
  }, [value, params, pathname, router])

  return (
    <div className="relative max-w-sm">
      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite placeholder:text-stone focus:border-action-blue focus:outline-none"
      />
      {pending ? (
        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-stone">…</span>
      ) : null}
    </div>
  )
}
