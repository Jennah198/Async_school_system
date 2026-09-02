'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { Icon } from '@/components/icons'
import { cx } from '@/components/ui'

/**
 * The academic year and term the dashboard is reading.
 *
 * `router.replace` rather than a form submit or a full reload: Next fetches
 * only the new server-rendered payload for this route and swaps it in, so the
 * shell, the sidebar and the scroll position all stay put while the numbers
 * change. The URL still carries the choice, which means the view is
 * linkable, bookmarkable and survives a refresh — a dashboard someone can send
 * to a colleague is worth more than one with the state hidden in a hook.
 *
 * `useTransition` keeps the old numbers on screen, dimmed, while the new ones
 * are fetched. Blanking the page on every change of term would be slower to
 * read even when it is faster to render.
 *
 * The options are the ones the server offered, which it took from Odoo. This
 * component invents no year and no term; where a role cannot read either model
 * the server passes empty lists and nothing renders.
 */
export function ContextSwitcher({
  years,
  terms,
  yearId,
  termId,
}: {
  years: Array<{ id: number; name: string }>
  terms: Array<{ id: number; name: string; yearId: number | null }>
  yearId: number | null
  termId: number | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  if (years.length === 0 && terms.length === 0) return null

  const go = (key: 'year' | 'term', value: string) => {
    const next = new URLSearchParams(params.toString())
    next.set(key, value)
    // A term belongs to one year, so changing the year invalidates the term
    // rather than filtering on a pair that cannot both be true.
    if (key === 'year') next.delete('term')
    startTransition(() => router.replace(`/dashboard?${next.toString()}`, { scroll: false }))
  }

  // Only the chosen year's terms, so the control cannot offer a combination
  // that would return nothing and read as "no data".
  const offered = yearId ? terms.filter((term) => term.yearId === yearId) : terms

  return (
    <div
      className={cx(
        'flex flex-wrap items-center gap-2 transition-opacity',
        pending && 'opacity-60',
      )}
      aria-busy={pending}
    >
      {years.length > 0 ? (
        <Picker
          label="Academic year"
          value={yearId === null ? 'all' : String(yearId)}
          onChange={(value) => go('year', value)}
          options={[
            ...years.map((year) => ({ value: String(year.id), label: year.name })),
            { value: 'all', label: 'All years' },
          ]}
        />
      ) : null}

      {offered.length > 0 ? (
        <Picker
          label="Term"
          value={termId === null ? 'all' : String(termId)}
          onChange={(value) => go('term', value)}
          options={[
            ...offered.map((term) => ({ value: String(term.id), label: term.name })),
            { value: 'all', label: 'Whole year' },
          ]}
        />
      ) : null}

      <span aria-live="polite" className="sr-only">
        {pending ? 'Updating the dashboard' : ''}
      </span>
    </div>
  )
}

function Picker({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="tabular appearance-none rounded-[8px] border border-silver bg-white py-1.5 pl-3 pr-8 text-[12.5px] text-graphite transition-colors hover:border-stone focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-action-blue"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Icon
        name="chevronDown"
        size={13}
        className="pointer-events-none absolute right-2.5 text-stone"
      />
    </label>
  )
}
