'use client'

import { useEffect, useRef, useState } from 'react'
import { searchStudentsAction } from '../actions'
import type { StudentSearchRow } from '@/lib/odoo/models/student'

const INPUT =
  'w-full rounded-[8px] border border-silver bg-white px-3 py-2 text-[13px] text-graphite ' +
  'placeholder:text-stone focus:border-action-blue focus:outline-none'

function studentLabel(student: StudentSearchRow): string {
  const id = student.regno || student.admission_number
  return id ? `${student.name} — ${id}` : student.name
}

export function StudentPicker({
  name,
  defaultValue,
  error,
}: {
  /** Hidden field name the selected student's id is submitted under. */
  name: string
  defaultValue?: { id: number; label: string }
  error?: string
}) {
  const [selected, setSelected] = useState<{ id: number; label: string } | null>(
    defaultValue ?? null,
  )
  const [query, setQuery] = useState(defaultValue?.label ?? '')
  const [results, setResults] = useState<StudentSearchRow[]>([])
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const requestId = useRef(0)

  useEffect(() => {
    // A selection already matches the query exactly — nothing to search for.
    if (selected && query === selected.label) return

    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }

    const currentRequest = ++requestId.current
    setPending(true)

    const timeout = setTimeout(() => {
      searchStudentsAction(query)
        .then((rows) => {
          if (requestId.current !== currentRequest) return
          setResults(rows)
          setOpen(true)
        })
        .finally(() => {
          if (requestId.current === currentRequest) setPending(false)
        })
    }, 300)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function choose(student: StudentSearchRow) {
    const label = studentLabel(student)
    setSelected({ id: student.id, label })
    setQuery(label)
    setResults([])
    setOpen(false)
  }

  function handleChange(value: string) {
    setQuery(value)
    if (selected && value !== selected.label) setSelected(null)
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selected ? String(selected.id) : ''} />

      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${name}-listbox`}
        autoComplete="off"
        className={INPUT}
        placeholder="Search by name, registration or admission number…"
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => {
          if (results.length > 0) setOpen(true)
        }}
      />

      {open ? (
        <ul
          id={`${name}-listbox`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-[8px] border border-silver bg-white py-1 text-[13px] shadow-lg"
        >
          {pending ? (
            <li className="px-3 py-2 text-stone">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-stone">No approved students match.</li>
          ) : (
            results.map((student) => (
              <li key={student.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected?.id === student.id}
                  className="block w-full px-3 py-2 text-left text-graphite hover:bg-paper"
                  onClick={() => choose(student)}
                >
                  {studentLabel(student)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {selected ? null : query.trim().length >= 2 && !open ? (
        <p className="mt-1 text-[11px] text-stone">Pick a student from the list.</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}