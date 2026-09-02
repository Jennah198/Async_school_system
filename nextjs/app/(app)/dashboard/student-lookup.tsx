'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui'
import { Icon } from '@/components/icons'

/**
 * The front desk's most common action: find one student, fast.
 *
 * It navigates to the student list with the term applied rather than querying
 * here, so the result set is the same one the directory shows — scoped by the
 * same record rules, paged the same way, and linkable.
 */
export function StudentLookup() {
  const router = useRouter()
  const [term, setTerm] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        const query = term.trim()
        router.push(query ? `/students?q=${encodeURIComponent(query)}` : '/students')
      }}
      className="flex flex-wrap gap-2"
    >
      <div className="relative min-w-0 flex-1">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-stone">
          <Icon name="search" size={14} />
        </span>
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name, student ID or admission number"
          aria-label="Find a student"
          className="w-full rounded-[8px] border border-silver bg-white py-2 pr-3 pl-9 text-[13px] text-graphite placeholder:text-stone focus:border-action-blue focus:outline-none"
        />
      </div>
      <Button type="submit" size="md">
        Find
      </Button>
    </form>
  )
}
